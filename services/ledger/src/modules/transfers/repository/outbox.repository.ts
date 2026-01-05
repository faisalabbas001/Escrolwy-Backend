import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PrismaTransactionClient } from '../../../common/types';
import { IOutboxRepository } from './interfaces';

/**
 * Outbox Repository
 *
 * Data access layer for outbox operations
 * Handles reliable Kafka event emission via Transactional Outbox Pattern
 * Implements IOutboxRepository interface (Dependency Inversion Principle)
 */
@Injectable()
export class OutboxRepository implements IOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Prisma client (transaction-aware)
   */
  private getClient(tx?: PrismaTransactionClient): PrismaService | typeof tx {
    return tx || this.prisma;
  }

  /**
   * Create outbox event
   * Supports transactions via optional tx parameter
   */
  async create(
    data: {
      eventType: string;
      eventKey: string;
      payload: any;
      status?: string;
    },
    tx?: PrismaTransactionClient,
  ) {
    const client = this.getClient(tx) as any;
    return client.ledgerOutbox.create({
      data: {
        eventType: data.eventType,
        eventKey: data.eventKey,
        payload: data.payload,
        status: data.status || 'pending',
      },
    });
  }

  /**
   * Find pending events for processing
   */
  async findPending(limit = 20) {
    return this.prisma.ledgerOutbox.findMany({
      where: {
        status: 'pending',
      },
      take: limit,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Mark event as sent
   */
  async markAsSent(id: string) {
    return this.prisma.ledgerOutbox.update({
      where: { id },
      data: {
        status: 'sent',
      },
    });
  }

  /**
   * Increment attempts counter
   */
  async incrementAttempts(id: string) {
    return this.prisma.ledgerOutbox.update({
      where: { id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Find event by ID
   */
  async findById(id: string) {
    return this.prisma.ledgerOutbox.findUnique({
      where: { id },
    });
  }
}

