import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { OutboxAdapter, OutboxEvent } from '@escrowly/kafka-publisher';

/**
 * Ledger Outbox Adapter
 *
 * Implements OutboxAdapter interface for Ledger Service's ledger_outbox table.
 * Maps ledger_outbox schema fields to OutboxEvent interface.
 * Uses FOR UPDATE SKIP LOCKED for safe concurrent processing.
 */
@Injectable()
export class LedgerOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find pending events with database-level locking.
   * Uses FOR UPDATE SKIP LOCKED to prevent concurrent processing.
   */
  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    const events = await this.prisma.$queryRaw<Array<{
      id: string;
      eventType: string;
      eventKey: string;
      payload: any; // Json type from Prisma
      status: string;
      attempts: number;
      lastError: string | null;
      createdAt: Date;
      publishedAt: Date | null;
      nextRetryAt: Date | null;
    }>>`
      SELECT 
        id,
        "eventType" as "eventType",
        "eventKey" as "eventKey",
        payload,
        status,
        attempts,
        "lastError" as "lastError",
        "createdAt" as "createdAt",
        "publishedAt" as "publishedAt",
        "nextRetryAt" as "nextRetryAt"
      FROM ledger_db.ledger_outbox
      WHERE status = 'pending' 
         OR (status = 'failed' 
             AND attempts < 5 
             AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW()))
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    // Map to OutboxEvent interface
    return events.map((e) => ({
      id: e.id,
      topic: e.eventType, // Map eventType to topic
      partitionKey: e.eventKey, // Map eventKey to partitionKey
      payload: typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload), // Serialize Json to string
      status: e.status as OutboxEvent['status'],
      retryCount: e.attempts, // Map attempts to retryCount
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
    await this.prisma.ledgerOutbox.update({
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
    await this.prisma.ledgerOutbox.update({
      where: { id },
      data: {
        status: 'failed',
        attempts: retryCount, // Map retryCount to attempts
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
    await this.prisma.ledgerOutbox.update({
      where: { id },
      data: {
        status: 'failed',
        attempts: retryCount, // Map retryCount to attempts
        lastError: error,
        nextRetryAt: null, // Clear nextRetryAt to prevent further retries
      },
    });
  }
}

