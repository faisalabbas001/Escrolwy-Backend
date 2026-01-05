import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEvent,
  EscrowCompletedPayload,
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
  TransferRepository,
} from '../../../modules/transfers/repository';
import { BalanceUpdatedEventProducer } from '../../../kafka/producers';
import { TransferValidator } from '../../../modules/transfers/validators/transfer.validator';
import { TransferType } from '../../../modules/transfers/dto/create-transfer.dto';

/**
 * Handles escrow.completed events.
 * Moves escrow funds from buyer reserved account to seller spendable account.
 * Creates transfer record with type 'escrow_released' for tracking.
 * Flow: buyer reserved → seller spendable
 */
@Injectable()
export class EscrowCompletedHandler
  implements IEventHandler<EscrowCompletedPayload>
{
  private readonly logger = new Logger(EscrowCompletedHandler.name);

  constructor(
    private readonly validator: EventValidatorService,
    private readonly prisma: PrismaService,
    private readonly transferRepository: TransferRepository,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
    private readonly transferValidator: TransferValidator,
  ) {}

  async handle(event: BaseEvent<EscrowCompletedPayload>): Promise<void> {
    this.logger.log(
      `Received escrow.completed event`,
      {
        topic: EscrowTopics.COMPLETED,
        eventId: event.metadata?.eventId,
        escrowId: event.payload?.escrowId,
      },
    );

    if (!this.validator.validate(event, EscrowTopics.COMPLETED)) {
      this.logger.warn('Validation failed for escrow.completed', {
        eventId: event.metadata?.eventId,
      });
      return;
    }

    const payload = event.payload;

    // Validate required fields
    if (!payload.sellerId) {
      this.logger.error('Missing sellerId in escrow.completed payload', {
        escrowId: payload.escrowId,
        payload: JSON.stringify(payload),
      });
      throw new Error('Missing sellerId in escrow.completed payload');
    }

    if (!payload.buyerId) {
      this.logger.error('Missing buyerId in escrow.completed payload', {
        escrowId: payload.escrowId,
        payload: JSON.stringify(payload),
      });
      throw new Error('Missing buyerId in escrow.completed payload');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Release principal from buyer reserved to seller spendable
        await this.releaseToSeller(
          payload.escrowId,
          payload.buyerId,
          payload.sellerId,
          payload.amount,
          payload.asset,
          payload.chain,
          tx,
        );

        // 2. Move buyer fee from buyer reserved to platform fees
        if (payload.buyerFee > 0) {
          await this.releaseBuyerFee(
            payload.escrowId,
            payload.buyerId,
            payload.buyerFee,
            payload.asset,
            payload.chain,
            tx,
          );
        }

        // 3. Move seller fee from seller reserved to platform fees
        if (payload.sellerFee > 0) {
          await this.releaseSellerFee(
            payload.escrowId,
            payload.sellerId,
            payload.sellerFee,
            payload.asset,
            payload.chain,
            tx,
          );
        }
      });

      this.logger.log(
        `Payout completed for escrow ${payload.escrowId}: ${payload.amount} ${payload.asset} principal + ${payload.buyerFee} buyer fee + ${payload.sellerFee} seller fee`,
        { escrowId: payload.escrowId, amount: payload.amount, buyerFee: payload.buyerFee, sellerFee: payload.sellerFee },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to release funds for escrow ${payload.escrowId}: ${error.message}`,
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
   * Release funds from buyer reserved to seller spendable
   * Creates transfer record with type 'escrow_released' for tracking
   */
  private async releaseToSeller(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    asset: string,
    chain: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-payout-seller`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Payout already processed for escrow ${escrowId}`, {
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

    // Validate buyer reserved balance
    const buyerReservedBalance = await this.accountRepository.getBalance(buyerReservedAccount.id, tx);
    this.transferValidator.validateBalance(buyerReservedBalance, amount);

    // Create transfer record with type 'escrow_released'
    const transfer = await this.transferRepository.create(
      {
        type: TransferType.ESCROW_RELEASED,
        asset,
        amount,
        chain,
        senderId: buyerId, // Source is buyer
        destinationUserId: sellerId, // Destination is seller
        destinationChain: chain,
        status: 'pending',
        idempotencyKey,
      },
      tx,
    );

    // Update status to 'process' when processing starts
    await this.transferRepository.updateStatus(transfer.id, 'process', null, tx);

    // Create journal linked to transfer record
    const journal = await this.journalRepository.create(
      {
        type: JournalType.ESCROW_PAY_RELEASED,
        asset,
        chain,
        userId: buyerId, // Source is buyer
        transferId: transfer.id, // Link to transfer record
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
        accountId: sellerSpendableAccount.id,
        amount: amount, // Credit seller spendable
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Update status to 'completed' after successful processing
    await this.transferRepository.updateStatus(transfer.id, 'completed', null, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [buyerReservedAccount.id, sellerSpendableAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Released funds from buyer reserved to seller spendable: ${amount} ${asset} for escrow ${escrowId} (transferId: ${transfer.id}, journalId: ${journal.id})`,
    );
  }

  /**
   * Release buyer fee from buyer reserved to platform fees (no transfer record)
   */
  private async releaseBuyerFee(
    escrowId: string,
    buyerId: string,
    amount: number,
    asset: string,
    chain: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-release-buyer-fee`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Buyer fee already released for escrow ${escrowId}`, {
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

    const feesAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'platform',
        ownerId: null,
        asset,
        chain,
        purpose: 'fees',
      },
      tx,
    );

    // Validate buyer reserved balance
    const buyerReservedBalance = await this.accountRepository.getBalance(buyerReservedAccount.id, tx);
    this.transferValidator.validateBalance(buyerReservedBalance, amount);

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
        accountId: buyerReservedAccount.id,
        amount: -amount, // Debit buyer reserved
      },
      {
        journalId: journal.id,
        accountId: feesAccount.id,
        amount: amount, // Credit platform fees
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [buyerReservedAccount.id, feesAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Released buyer fee from reserved to platform fees: ${amount} ${asset} for escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }

  /**
   * Release seller fee from seller reserved to platform fees (no transfer record)
   */
  private async releaseSellerFee(
    escrowId: string,
    sellerId: string,
    amount: number,
    asset: string,
    chain: string,
    tx: any,
  ): Promise<void> {
    const idempotencyKey = `escrow-${escrowId}-release-seller-fee`;

    // Check idempotency
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Seller fee already released for escrow ${escrowId}`, {
        journalId: existingJournal.id,
        idempotencyKey,
      });
      return;
    }

    // Get or create accounts
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

    const feesAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'platform',
        ownerId: null,
        asset,
        chain,
        purpose: 'fees',
      },
      tx,
    );

    // Validate seller reserved balance
    const sellerReservedBalance = await this.accountRepository.getBalance(sellerReservedAccount.id, tx);
    this.transferValidator.validateBalance(sellerReservedBalance, amount);

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
        accountId: sellerReservedAccount.id,
        amount: -amount, // Debit seller reserved
      },
      {
        journalId: journal.id,
        accountId: feesAccount.id,
        amount: amount, // Credit platform fees
      },
    ];

    this.transferValidator.validateDoubleEntry(entries);
    await this.entryRepository.createMany(entries, tx);

    // Emit balance updated events
    await this.balanceUpdatedProducer.produce(
      {
        accountIds: [sellerReservedAccount.id, feesAccount.id],
      },
      tx,
    );

    this.logger.log(
      `Released seller fee from reserved to platform fees: ${amount} ${asset} for escrow ${escrowId} (journalId: ${journal.id})`,
    );
  }
}

