import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEvent,
  EscrowTopics,
  PaymentCompletedPayload,
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
 * Handles escrow.payment.completed events.
 * Reserves funds incrementally as each payment arrives WITHOUT creating transfer records:
 * - Buyer payment: reserves buyer principal + buyer fee (if any) via journal/entries
 * - Seller payment: reserves seller fee (if any) via journal/entries
 * Uses idempotency keys on journals to prevent duplicate reservations.
 */
@Injectable()
export class PaymentCompletedHandler
  implements IEventHandler<PaymentCompletedPayload>
{
  private readonly logger = new Logger(PaymentCompletedHandler.name);

  constructor(
    private readonly validator: EventValidatorService,
    private readonly prisma: PrismaService,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
    private readonly transferValidator: TransferValidator,
  ) {}

  async handle(event: BaseEvent<PaymentCompletedPayload>): Promise<void> {
    this.logger.log(
      `Received escrow.payment.completed event`,
      {
        topic: EscrowTopics.PAYMENT_COMPLETED,
        eventId: event.metadata?.eventId,
        escrowId: event.payload?.escrowId,
      },
    );

    // Validate schema
    if (!this.validator.validate(event, EscrowTopics.PAYMENT_COMPLETED)) {
      this.logger.warn('Validation failed for escrow.payment.completed', {
        eventId: event.metadata?.eventId,
      });
      return;
    }

    const { payload, metadata } = event;
    // Payload contains only the amounts being paid in THIS transaction
    const buyerFee = (payload as any).buyerFee ?? 0;
    const sellerFee = (payload as any).sellerFee ?? 0;
    const buyerAmount = (payload as any).buyerAmount ?? 0; // Only principal being paid now

    this.logger.log(
      `Processing payment for escrow ${payload.escrowId}: buyerPrincipal=${buyerAmount}, buyerFee=${buyerFee}, sellerFee=${sellerFee}`,
      {
        eventId: metadata.eventId,
        correlationId: metadata.correlationId,
        escrowId: payload.escrowId,
      },
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        // Reserve funds incrementally - only process what's in this event
        // Idempotency keys on journals ensure no duplicate reservations

        // 1) Buyer principal -> platform escrow holding (only if buyerAmount > 0)
        if (buyerAmount > 0) {
          await this.reserveBuyerPrincipal(
            payload.escrowId,
            payload.buyerId,
            buyerAmount,
            payload.asset,
            payload.chain,
            tx,
          );
        }

        // 2) Buyer fee (if any) -> platform fees
        if (buyerFee > 0) {
          await this.reserveBuyerFee(
            payload.escrowId,
            payload.buyerId,
            buyerFee,
            payload.asset,
            payload.chain,
            tx,
          );
        }

        // 3) Seller fee (if any) -> platform fees
        if (sellerFee > 0) {
          await this.reserveSellerFee(
            payload.escrowId,
            payload.sellerId,
            sellerFee,
            payload.asset,
            payload.chain,
            tx,
          );
        }
      });

      this.logger.log(
        `Payment processed for escrow ${payload.escrowId}: reserved ${buyerAmount > 0 ? `${buyerAmount} principal` : ''}${buyerFee > 0 ? `, ${buyerFee} buyer fee` : ''}${sellerFee > 0 ? `, ${sellerFee} seller fee` : ''}`,
        { escrowId: payload.escrowId, buyerFee, sellerFee, buyerAmount },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to reserve funds for escrow ${payload.escrowId}: ${error.message}`,
        {
          escrowId: payload.escrowId,
          buyerAmount,
          buyerFee,
          sellerFee,
          error: error.message,
        },
      );
      throw error;
    }
  }

  /**
   * Reserve buyer principal to buyer's reserved account (no transfer record)
   * Flow: buyer spendable → buyer reserved
   */
  private async reserveBuyerPrincipal(
    escrowId: string,
    buyerId: string,
    amount: number,
    asset: string,
    chain: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-buyer-principal`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Buyer principal already reserved for escrow ${escrowId}`, {
        journalId: existingJournal.id,
        idempotencyKey,
      });
      return;
    }

    // Get or create accounts
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

    // Validate balance
    const balance = await this.accountRepository.getBalance(buyerSpendableAccount.id, tx);
    this.transferValidator.validateBalance(balance, amount);

    // Create journal (no transfer record)
    const journal = await this.journalRepository.create(
      {
        type: JournalType.ESCROW_PAY_RESERVED,
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
        accountId: buyerSpendableAccount.id,
        amount: -amount, // Debit buyer spendable
      },
      {
        journalId: journal.id,
        accountId: buyerReservedAccount.id,
        amount: amount, // Credit buyer reserved
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [buyerSpendableAccount.id, buyerReservedAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Reserved buyer principal: ${amount} ${asset} to buyer reserved account for escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }

  /**
   * Reserve buyer fee to buyer's reserved account (no transfer record)
   * Flow: buyer spendable → buyer reserved
   */
  private async reserveBuyerFee(
    escrowId: string,
    buyerId: string,
    amount: number,
    asset: string,
    chain: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-buyer-fee`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Buyer fee already reserved for escrow ${escrowId}`, {
        journalId: existingJournal.id,
        idempotencyKey,
      });
      return;
    }

    // Get or create accounts
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

    // Validate balance
    const balance = await this.accountRepository.getBalance(buyerSpendableAccount.id, tx);
    this.transferValidator.validateBalance(balance, amount);

    // Create journal (no transfer record)
    const journal = await this.journalRepository.create(
      {
        type: JournalType.PLATFORM_FEE,
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
        accountId: buyerSpendableAccount.id,
        amount: -amount, // Debit buyer spendable
      },
      {
        journalId: journal.id,
        accountId: buyerReservedAccount.id,
        amount: amount, // Credit buyer reserved
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [buyerSpendableAccount.id, buyerReservedAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Reserved buyer fee: ${amount} ${asset} to buyer reserved account for escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }

  /**
   * Reserve seller fee to seller's reserved account (no transfer record)
   * Flow: seller spendable → seller reserved
   */
  private async reserveSellerFee(
    escrowId: string,
    sellerId: string,
    amount: number,
    asset: string,
    chain: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-seller-fee`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Seller fee already reserved for escrow ${escrowId}`, {
        journalId: existingJournal.id,
        idempotencyKey,
      });
      return;
    }

    // Get or create accounts
    const sellerSpendableAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: sellerId,
        asset,
        chain,
        purpose: 'spendable',
      },
      tx,
    );

    const sellerReservedAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: sellerId,
        asset,
        chain,
        purpose: 'reserved',
      },
      tx,
    );

    // Validate balance
    const balance = await this.accountRepository.getBalance(sellerSpendableAccount.id, tx);
    this.transferValidator.validateBalance(balance, amount);

    // Create journal (no transfer record)
    const journal = await this.journalRepository.create(
      {
        type: JournalType.PLATFORM_FEE,
        asset,
        chain,
        userId: sellerId,
        transferId: null, // No transfer record
        idempotencyKey,
      },
      tx,
    );

    // Create double-entry accounting entries
    const entries = [
      {
        journalId: journal.id,
        accountId: sellerSpendableAccount.id,
        amount: -amount, // Debit seller spendable
      },
      {
        journalId: journal.id,
        accountId: sellerReservedAccount.id,
        amount: amount, // Credit seller reserved
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [sellerSpendableAccount.id, sellerReservedAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Reserved seller fee: ${amount} ${asset} to seller reserved account for escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }
}

