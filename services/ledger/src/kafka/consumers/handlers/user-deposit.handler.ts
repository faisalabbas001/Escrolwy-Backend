import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, LedgerTopics } from '@escrowly/kafka-core';
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

/**
 * User Deposit Payload
 * 
 * Payload for user deposit events that credit user accounts from platform custody pool
 */
export interface UserDepositPayload {
  userId: string;
  amount: number;
  asset: string;
  chain: string;
  transactionHash?: string;
  depositId?: string; // Optional idempotency key
}

/**
 * Handles user.deposit events.
 * Creates journal entries and accounting entries directly (no transfer record).
 * Deposits are direct accounting entries: platform custody → user spendable.
 * This is used for seeding initial balances and external deposits.
 */
@Injectable()
export class UserDepositHandler implements IEventHandler<UserDepositPayload> {
  private readonly logger = new Logger(UserDepositHandler.name);

  constructor(
    private readonly validator: EventValidatorService,
    private readonly prisma: PrismaService,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly accountRepository: AccountRepository,
    private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
  ) {}

  async handle(event: BaseEvent<UserDepositPayload>): Promise<void> {
    this.logger.log(`Received user.deposit event`, {
      eventId: event.metadata?.eventId,
      userId: event.payload?.userId,
      amount: event.payload?.amount,
    });

    // Basic validation - check if payload exists
    if (!event.payload) {
      this.logger.error('Missing payload in user.deposit event', {
        eventId: event.metadata?.eventId,
      });
      return;
    }

    const payload = event.payload;

    // Validate required fields
    if (!payload.userId || !payload.amount || !payload.asset || !payload.chain) {
      this.logger.error('Missing required fields in user.deposit payload', {
        eventId: event.metadata?.eventId,
        payload: JSON.stringify(payload),
      });
      return;
    }

    const idempotencyKey = payload.transactionHash || `deposit-${payload.userId}-${event.metadata.eventId}`;

    // Check idempotency to prevent duplicate deposits
    const existingJournal = await this.journalRepository.findByIdempotencyKey(idempotencyKey);
    if (existingJournal) {
      this.logger.warn(`Deposit already processed with idempotency key: ${idempotencyKey}`, {
        journalId: existingJournal.id,
        userId: payload.userId,
      });
      return;
    }

    this.logger.debug('Creating deposit journal and entries (no transfer record)', {
      userId: payload.userId,
      amount: payload.amount,
      asset: payload.asset,
      chain: payload.chain,
      idempotencyKey,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        // Get or create accounts
        const platformAccount = await this.accountRepository.findOrCreate(
          {
            ownerType: 'platform',
            ownerId: null,
            asset: payload.asset,
            chain: payload.chain,
            purpose: 'treasury_hot',
          },
          tx,
        );

        const userAccount = await this.accountRepository.findOrCreate(
          {
            ownerType: 'user',
            ownerId: payload.userId,
            asset: payload.asset,
            chain: payload.chain,
            purpose: 'spendable',
          },
          tx,
        );

        // Create journal (no transfer record for deposits)
        const journal = await this.journalRepository.create(
          {
            type: JournalType.DEPOSIT,
            asset: payload.asset,
            chain: payload.chain,
            userId: payload.userId, // user deposit is our platform account
            transferId: null, // No transfer record for deposits
            idempotencyKey,
          },
          tx,
        );

        // Create double-entry accounting entries
        const entries = [
          {
            journalId: journal.id,
            accountId: platformAccount.id,
            amount: -payload.amount, // Debit platform custody
          },
          {
            journalId: journal.id,
            accountId: userAccount.id,
            amount: payload.amount, // Credit user spendable
          },
        ];

        await this.entryRepository.createMany(entries, tx);

        // Emit balance updated events for both accounts
        await this.balanceUpdatedProducer.produce(
          {
            accountIds: [platformAccount.id, userAccount.id],
          },
          tx,
        );

        this.logger.log(
          `Deposit journaled for user ${payload.userId}: ${payload.amount} ${payload.asset} on ${payload.chain} (journalId: ${journal.id})`,
          {
            journalId: journal.id,
            userId: payload.userId,
            amount: payload.amount,
            asset: payload.asset,
            chain: payload.chain,
          },
        );
      });
    } catch (error: any) {
      this.logger.error(`Failed to create deposit for user ${payload.userId}: ${error.message}`, {
        userId: payload.userId,
        amount: payload.amount,
        error: error.message,
      });
      throw error;
    }
  }
}

