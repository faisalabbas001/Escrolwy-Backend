import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxAdapter, OutboxEvent } from '@escrowly/kafka-publisher';

/**
 * Prisma Outbox Adapter for Inquiry Service
 *
 * Implements OutboxAdapter interface for Prisma/PostgreSQL.
 * Uses FOR UPDATE SKIP LOCKED for safe concurrent processing.
 */
@Injectable()
export class PrismaOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find pending events with database-level locking.
   * Uses FOR UPDATE SKIP LOCKED to prevent concurrent processing.
   */
  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    const events = await this.prisma.$queryRaw<Array<{
      id: string;
      topic: string;
      partitionKey: string;
      payload: string;
      status: string;
      retryCount: number;
      lastError: string | null;
      createdAt: Date;
      publishedAt: Date | null;
      nextRetryAt: Date | null;
    }>>`
      SELECT 
        id,
        topic,
        "partitionKey" as "partitionKey",
        payload,
        status,
        "retryCount" as "retryCount",
        "lastError" as "lastError",
        "createdAt" as "createdAt",
        "publishedAt" as "publishedAt",
        "nextRetryAt" as "nextRetryAt"
      FROM inquiry_db.outbox_events
      WHERE status = 'pending' 
         OR (status = 'failed' 
             AND "retryCount" < 5 
             AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW()))
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    // Map to OutboxEvent interface
    return events.map((e) => ({
      id: e.id,
      topic: e.topic,
      partitionKey: e.partitionKey,
      payload: e.payload,
      status: e.status as OutboxEvent['status'],
      retryCount: e.retryCount,
      nextRetryAt: e.nextRetryAt ? new Date(e.nextRetryAt) : undefined,
      lastError: e.lastError || undefined,
      createdAt: new Date(e.createdAt),
      publishedAt: e.publishedAt ? new Date(e.publishedAt) : undefined,
    }));
  }

  /**
   * Mark event as successfully published.
   */
  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        lastError: null,
        nextRetryAt: null,
      },
    });
  }

  /**
   * Mark event as failed and schedule retry.
   */
  async markFailed(
    id: string,
    error: string,
    retryCount: number,
    nextRetryAt: Date,
  ): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'failed',
        retryCount,
        lastError: error,
        nextRetryAt,
      },
    });
  }

  /**
   * Mark event as permanently failed (exceeded max retries).
   */
  async markPermanentlyFailed(
    id: string,
    error: string,
    retryCount: number,
  ): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'failed',
        retryCount,
        lastError: error,
        nextRetryAt: null,
      },
    });
  }
}
