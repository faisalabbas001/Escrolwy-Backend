import { OutboxEvent } from './outbox-event.interface';

/**
 * Outbox Adapter Interface
 *
 * DB-agnostic interface for outbox operations.
 * Each service must implement this adapter for their specific database/ORM.
 *
 * The adapter is responsible for:
 * - Finding pending events (with database-level locking)
 * - Updating event status
 * - Handling retry logic
 */
export interface OutboxAdapter {
  /**
   * Find pending events that are ready to be processed.
   * Must use database-level locking (FOR UPDATE SKIP LOCKED) to prevent
   * concurrent processing by multiple instances.
   *
   * Should return events where:
   * - status = 'pending' OR
   * - status = 'failed' AND retryCount < maxRetries AND nextRetryAt <= now()
   *
   * @param limit Maximum number of events to return
   * @returns Array of outbox events ready for processing
   */
  findPendingEvents(limit: number): Promise<OutboxEvent[]>;

  /**
   * Mark an event as successfully published.
   * Called after successful Kafka publish.
   *
   * @param id Event ID
   */
  markPublished(id: string): Promise<void>;

  /**
   * Mark an event as failed and schedule retry.
   * Called when Kafka publish fails.
   *
   * @param id Event ID
   * @param error Error message
   * @param retryCount New retry count (incremented)
   * @param nextRetryAt When to retry next (exponential backoff)
   */
  markFailed(
    id: string,
    error: string,
    retryCount: number,
    nextRetryAt: Date,
  ): Promise<void>;

  /**
   * Mark an event as permanently failed (exceeded max retries).
   * Called when retry limit is reached.
   *
   * @param id Event ID
   * @param error Final error message
   * @param retryCount Final retry count
   */
  markPermanentlyFailed(id: string, error: string, retryCount: number): Promise<void>;
}

