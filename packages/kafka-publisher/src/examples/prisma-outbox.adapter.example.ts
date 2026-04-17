/**
 * Prisma Outbox Adapter Example
 *
 * Reference implementation for services using Prisma with PostgreSQL.
 * Copy this file to your service and adapt it to your schema.
 *
 * Requirements:
 * - Outbox table must have: id, topic, partitionKey, payload, status, retryCount, lastError, createdAt, publishedAt, nextRetryAt
 * - Use FOR UPDATE SKIP LOCKED for safe concurrent processing
 * - Map your schema fields to OutboxEvent interface
 */

import { Injectable } from '@nestjs/common';
import { OutboxAdapter, OutboxEvent } from '../interfaces';

/**
 * Example: Prisma Outbox Adapter for Escrow Service
 *
 * This adapter works with the OutboxEvent model in escrow service.
 * Adapt the field names and table names to match your schema.
 */
// Example implementation - uncomment and adapt to your service
/*
@Injectable()
export class PrismaOutboxAdapterExample implements OutboxAdapter {
  constructor(
    // Inject your PrismaService
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Find pending events with database-level locking.
   * Uses FOR UPDATE SKIP LOCKED to prevent concurrent processing.
   */
  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    // Example using Prisma raw query (PostgreSQL)
    // Adapt table name and field names to your schema
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
      FROM outbox_events
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
        // Clear retry fields
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
        // Clear nextRetryAt to prevent further retries
        nextRetryAt: null,
      },
    });
  }
}
*/

/**
 * Alternative: Using Prisma model methods (if your schema matches exactly)
 *
 * Note: Prisma doesn't support FOR UPDATE SKIP LOCKED directly in findMany,
 * so you'll need to use raw queries for the locking behavior.
 * However, you can use Prisma models for updates:
 */
// Example implementation - uncomment and adapt to your service
/*
export class PrismaOutboxAdapterAlternative implements OutboxAdapter {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    // Still use raw query for FOR UPDATE SKIP LOCKED
    // (same as above)
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
      SELECT * FROM outbox_events
      WHERE status = 'pending' 
         OR (status = 'failed' AND "retryCount" < 5 AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= NOW()))
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    return events.map(this.mapToOutboxEvent);
  }

  async markPublished(id: string): Promise<void> {
    // Use Prisma model for updates (type-safe)
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

  private mapToOutboxEvent(row: any): OutboxEvent {
    return {
      id: row.id,
      topic: row.topic,
      partitionKey: row.partitionKey,
      payload: row.payload,
      status: row.status,
      retryCount: row.retryCount,
      nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAt) : undefined,
      lastError: row.lastError || undefined,
      createdAt: new Date(row.createdAt),
      publishedAt: row.publishedAt ? new Date(row.publishedAt) : undefined,
    };
  }
}
*/

