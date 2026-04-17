import { Injectable } from '@nestjs/common';
import { LedgerTopics, BalanceUpdatedPayload } from '@escrowly/kafka-core';
import { AccountRepository } from '../../modules/transfers/repository';
import { IEventProducer } from './event-producer.interface';
import { OutboxEventService } from './services/outbox-event.service';
import { PrismaTransactionClient } from './types';

/**
 * Balance Updated Event Producer
 *
 * Single Responsibility: Builds BALANCE_UPDATED event payload
 * Follows Single Responsibility Principle (SRP) - focuses on payload construction
 * Follows Dependency Inversion Principle (DIP) - implements IEventProducer
 * Follows DRY principle - uses OutboxEventService for outbox creation
 */
@Injectable()
export class BalanceUpdatedEventProducer
  implements IEventProducer<{
    accountIds: string[];
  }>
{
  constructor(
    private readonly outboxEventService: OutboxEventService,
    private readonly accountRepository: AccountRepository,
  ) {}

  async produce(
    data: { accountIds: string[] },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    // Produce events for all affected accounts
    for (const accountId of data.accountIds) {
      await this.produceForAccount(accountId, tx);
    }
  }

  /**
   * Produce balance updated event for a single account
   */
  private async produceForAccount(
    accountId: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      return;
    }

    const balance = await this.accountRepository.getBalance(accountId, tx);

    const payload: BalanceUpdatedPayload = {
      accountId: account.id,
      ownerType: account.ownerType,
      ownerId: account.ownerId || undefined,
      asset: account.asset,
      chain: account.chain,
      purpose: account.purpose,
      balance,
      updatedAt: new Date().toISOString(),
    };

    await this.outboxEventService.createEvent(
      LedgerTopics.BALANCE_UPDATED,
      account.id,
      payload,
      tx,
    );
  }
}

