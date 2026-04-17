import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEvent,
  EscrowRefundedPayload,
  EscrowTopics,
} from '@escrowly/kafka-core';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators/event-validator.service';
import { JournalType } from '../../../common/types';
import { PrismaService } from '../../../common/database/prisma.service';
import {
  JournalRepository,
  EntryRepository,
  AccountRepository,
} from '../../../modules/transfers/repository';
import { BalanceUpdatedEventProducer } from '../../../kafka/producers';
import { TransferValidator } from '../../../modules/transfers/validators/transfer.validator';

/**
 * Handles escrow.refunded events.
 * Moves escrow funds from buyer reserved account to buyer spendable account (refund, no transfer record).
 * Flow: buyer reserved → buyer spendable
 */
@Injectable()
export class EscrowRefundedHandler
  implements IEventHandler<EscrowRefundedPayload>
{
  private readonly logger = new Logger(EscrowRefundedHandler.name);

  constructor(
    private readonly validator: EventValidatorService,
    private readonly prisma: PrismaService,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
    private readonly transferValidator: TransferValidator,
  ) {}

  async handle(event: BaseEvent<EscrowRefundedPayload>): Promise<void> {
    this.logger.log(
      `Received escrow.refunded event`,
      {
        topic: EscrowTopics.REFUNDED,
        eventId: event.metadata?.eventId,
        escrowId: event.payload?.escrowId,
      },
    );

    if (!this.validator.validate(event, EscrowTopics.REFUNDED)) {
      this.logger.warn('Validation failed for escrow.refunded', {
        eventId: event.metadata?.eventId,
      });
      return;
    }

    const payload = event.payload;

    // Validate required fields
    if (!payload.buyerId) {
      this.logger.error('Missing buyerId in escrow.refunded payload', {
        escrowId: payload.escrowId,
        payload: JSON.stringify(payload),
      });
      throw new Error('Missing buyerId in escrow.refunded payload');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.refundToBuyer(
          payload.escrowId,
          payload.buyerId,
          payload.amount,
          payload.asset,
          payload.chain,
          tx,
        );
      });

      this.logger.log(
        `Refund completed for escrow ${payload.escrowId}: ${payload.amount} ${payload.asset} from buyer reserved to buyer spendable`,
        { escrowId: payload.escrowId, amount: payload.amount, buyerId: payload.buyerId },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to refund funds for escrow ${payload.escrowId}: ${error.message}`,
        {
          escrowId: payload.escrowId,
          amount: payload.amount,
          error: error.message,
        },
      );
      throw error;
    }
  }

  /**
   * Refund funds from buyer reserved to buyer spendable (no transfer record)
   */
  private async refundToBuyer(
    escrowId: string,
    buyerId: string,
    amount: number,
    asset: string,
    chain: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-refund-buyer`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Refund already processed for escrow ${escrowId}`, {
        journalId: existingJournal.id,
        idempotencyKey,
      });
      return;
    }

    // Get or create accounts
    const buyerReservedAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: buyerId,
        asset,
        chain,
        purpose: 'reserved',
      },
      tx,
    );

    const buyerSpendableAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: buyerId,
        asset,
        chain,
        purpose: 'spendable',
      },
      tx,
    );

    // Validate buyer reserved balance
    const buyerReservedBalance = await this.accountRepository.getBalance(buyerReservedAccount.id, tx);
    this.transferValidator.validateBalance(buyerReservedBalance, amount);

    // Create journal (no transfer record)
    const journal = await this.journalRepository.create(
      {
        type: JournalType.ESCROW_PAY_RELEASED_BUYER,
        asset,
        chain,
        userId: buyerId,
        transferId: null, // No transfer record
        idempotencyKey,
      },
      tx,
    );

    // Create double-entry accounting entries
    const entries = [
      {
        journalId: journal.id,
        accountId: buyerReservedAccount.id,
        amount: -amount, // Debit buyer reserved
      },
      {
        journalId: journal.id,
        accountId: buyerSpendableAccount.id,
        amount: amount, // Credit buyer spendable
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [buyerReservedAccount.id, buyerSpendableAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Refunded funds from buyer reserved to buyer spendable: ${amount} ${asset} for escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }
}

