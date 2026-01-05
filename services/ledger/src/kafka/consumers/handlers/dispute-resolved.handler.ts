import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEvent,
  DisputeResolvedPayload,
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
 * Handles escrow.resolved events (dispute resolution).
 * Handles three resolution types:
 * - buyer_wins: Refund to buyer (buyer reserved → buyer spendable)
 * - seller_wins: Release to seller (buyer reserved → seller spendable)
 * - refund: Refund to buyer (buyer reserved → buyer spendable)
 * 
 * All flows use buyer reserved account as source (no transfer record).
 */
@Injectable()
export class DisputeResolvedHandler
  implements IEventHandler<DisputeResolvedPayload>
{
  private readonly logger = new Logger(DisputeResolvedHandler.name);

  constructor(
    private readonly validator: EventValidatorService,
    private readonly prisma: PrismaService,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
    private readonly transferValidator: TransferValidator,
  ) {}

  async handle(event: BaseEvent<DisputeResolvedPayload>): Promise<void> {
    this.logger.log(
      `Received escrow.resolved event`,
      {
        topic: EscrowTopics.RESOLVED,
        eventId: event.metadata?.eventId,
        escrowId: event.payload?.escrowId,
      },
    );

    if (!this.validator.validate(event, EscrowTopics.RESOLVED)) {
      this.logger.warn('Validation failed for escrow.resolved', {
        eventId: event.metadata?.eventId,
      });
      return;
    }

    const payload = event.payload;

    // Log payload for debugging
    this.logger.debug('Escrow.resolved payload received', {
      escrowId: payload.escrowId,
      buyerId: payload.buyerId,
      sellerId: payload.sellerId,
      amount: payload.amount,
      asset: payload.asset,
      chain: payload.chain,
      resolution: payload.resolution,
      resolvedBy: payload.resolvedBy,
      ledgerAction: payload.ledgerAction,
    });

    // Validate required fields
    if (!payload.buyerId || !payload.sellerId) {
      this.logger.error('Missing buyerId or sellerId in escrow.resolved payload', {
        escrowId: payload.escrowId,
        payload: JSON.stringify(payload),
      });
      throw new Error('Missing buyerId or sellerId in escrow.resolved payload');
    }

    // Determine journal type and destination based on resolution
    let journalType: JournalType;
    let destinationUserId: string;

    switch (payload.resolution) {
      case 'buyer_wins':
      case 'refund':
        // Refund to buyer
        journalType = JournalType.ESCROW_PAY_RELEASED_BUYER;
        destinationUserId = payload.buyerId;
        break;
      case 'seller_wins':
        // Release to seller
        journalType = JournalType.ESCROW_PAY_RELEASED;
        destinationUserId = payload.sellerId;
        break;
      default:
        this.logger.error(`Unknown resolution type: ${payload.resolution}`, {
          escrowId: payload.escrowId,
          resolution: payload.resolution,
        });
        throw new Error(`Unknown resolution type: ${payload.resolution}`);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.resolveDispute(
          payload.escrowId,
          payload.buyerId,
          destinationUserId,
          payload.amount,
          payload.asset,
          payload.chain,
          journalType,
          payload.resolution,
          tx,
        );
      });

      this.logger.log(
        `Dispute resolution completed for escrow ${payload.escrowId}: resolution=${payload.resolution}, amount=${payload.amount} ${payload.asset} to ${destinationUserId}`,
        {
          escrowId: payload.escrowId,
          resolution: payload.resolution,
          amount: payload.amount,
          destinationUserId: destinationUserId,
        },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to resolve dispute for escrow ${payload.escrowId}: ${error.message}`,
        {
          escrowId: payload.escrowId,
          resolution: payload.resolution,
          amount: payload.amount,
          error: error.message,
        },
      );
      throw error;
    }
  }

  /**
   * Resolve dispute by moving funds from buyer reserved to resolved party (no transfer record)
   */
  private async resolveDispute(
    escrowId: string,
    buyerId: string,
    destinationUserId: string,
    amount: number,
    asset: string,
    chain: string,
    journalType: JournalType,
    resolution: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-dispute-resolved-${resolution}`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Dispute resolution already processed for escrow ${escrowId}`, {
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

    const destinationAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: destinationUserId,
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
        type: journalType,
        asset,
        chain,
        userId: buyerId, // Source is buyer
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
        accountId: destinationAccount.id,
        amount: amount, // Credit destination (buyer or seller spendable)
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [buyerReservedAccount.id, destinationAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Resolved dispute: ${amount} ${asset} from buyer reserved to ${destinationUserId === buyerId ? 'buyer' : 'seller'} spendable for escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }
}

