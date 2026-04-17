import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * Outbox Repository
 *
 * Handles direct outbox event persistence for the Wallet Service.
 * Used when events need to be written within a transaction.
 */
@Injectable()
export class OutboxRepository {
  private readonly logger = new Logger(OutboxRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save an event to the outbox table
   */
  async save<T>(
    topic: string,
    partitionKey: string,
    payload: T,
    error?: string,
    status: 'pending' | 'failed' = 'pending',
  ): Promise<string> {
    const id = uuidv4();

    await this.prisma.outboxEvent.create({
      data: {
        id,
        topic,
        partitionKey,
        payload: JSON.stringify(payload),
        status,
        lastError: error,
        retryCount: error ? 1 : 0,
      },
    });

    this.logger.debug(`Saved event to outbox: ${topic} (${id})`);

    return id;
  }

  /**
   * Save an event within a Prisma transaction
   */
  async saveInTransaction<T>(
    tx: any, // Prisma transaction client
    topic: string,
    partitionKey: string,
    payload: T,
  ): Promise<string> {
    const id = uuidv4();

    await tx.outboxEvent.create({
      data: {
        id,
        topic,
        partitionKey,
        payload: JSON.stringify(payload),
        status: 'pending',
        retryCount: 0,
      },
    });

    return id;
  }
}

