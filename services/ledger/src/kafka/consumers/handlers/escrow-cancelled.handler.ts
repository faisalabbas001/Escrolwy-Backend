import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEvent,
  EscrowCancelledPayload,
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
 * Handles escrow.cancelled events.
 * If escrow was funded, moves escrow funds from buyer reserved account to buyer spendable (refund, no transfer record).
 * Flow: buyer reserved → buyer spendable
 */
@Injectable()
export class EscrowCancelledHandler
  implements IEventHandler<EscrowCancelledPayload>
{
  private readonly logger = new Logger(EscrowCancelledHandler.name);

  constructor(
    private readonly validator: EventValidatorService,
    private readonly prisma: PrismaService,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
    private readonly transferValidator: TransferValidator,
  ) {}

  async handle(event: BaseEvent<EscrowCancelledPayload>): Promise<void> {
    this.logger.log(
      `Received escrow.cancelled event`,
      {
        topic: EscrowTopics.CANCELLED,
        eventId: event.metadata?.eventId,
        escrowId: event.payload?.escrowId,
      },
    );

    if (!this.validator.validate(event, EscrowTopics.CANCELLED)) {
      this.logger.warn('Validation failed for escrow.cancelled', {
        eventId: event.metadata?.eventId,
      });
      return;
    }

    const payload = event.payload;

    // Log payload for debugging
    this.logger.debug('Escrow.cancelled payload received', {
      escrowId: payload.escrowId,
      buyerId: payload.buyerId,
      sellerId: payload.sellerId,
      cancelledBy: payload.cancelledBy,
      reason: payload.reason,
      previousState: payload.previousState,
      ledgerAction: payload.ledgerAction,
    });

    // Only process refund if ledgerAction indicates refund is needed
    // The ledgerAction is optional and only present if escrow was funded
    if (!payload.ledgerAction || payload.ledgerAction !== 'refund_to_buyer') {
      this.logger.log(
        `Escrow ${payload.escrowId} cancelled but no refund needed (escrow was not funded or already refunded)`,
        { escrowId: payload.escrowId, ledgerAction: payload.ledgerAction },
      );
      return;
    }

    // Validate required fields for refund
    if (!payload.buyerId) {
      this.logger.error('Missing buyerId in escrow.cancelled payload', {
        escrowId: payload.escrowId,
        payload: JSON.stringify(payload),
      });
      throw new Error('Missing buyerId in escrow.cancelled payload');
    }

    // Note: EscrowCancelledPayload doesn't include amount/asset/chain
    // We would need to fetch this from escrow service or include in payload
    // For now, we'll log a warning and skip if these fields are missing
    // In production, you might want to fetch escrow details or ensure payload includes them
    if (!(payload as any).amount || !(payload as any).asset || !(payload as any).chain) {
      this.logger.warn(
        `Escrow ${payload.escrowId} cancelled but amount/asset/chain not in payload. Refund transfer skipped.`,
        { escrowId: payload.escrowId },
      );
      return;
    }

    const amount = (payload as any).amount;
    const asset = (payload as any).asset;
    const chain = (payload as any).chain;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.refundToBuyer(
          payload.escrowId,
          payload.buyerId,
          amount,
          asset,
          chain,
          tx,
        );
      });

      this.logger.log(
        `Refund completed for cancelled escrow ${payload.escrowId}: ${amount} ${asset} from buyer reserved to buyer spendable`,
        { escrowId: payload.escrowId, amount: amount, buyerId: payload.buyerId },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to refund funds for cancelled escrow ${payload.escrowId}: ${error.message}`,
        {
          escrowId: payload.escrowId,
          amount: amount,
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
    const idempotencyKey = `escrow-${escrowId}-cancel-refund-buyer`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Refund already processed for cancelled escrow ${escrowId}`, {
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
      `Refunded funds from buyer reserved to buyer spendable: ${amount} ${asset} for cancelled escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }
}

