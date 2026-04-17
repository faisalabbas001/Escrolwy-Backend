/**
 * Outbox Event Interface
 *
 * Minimal required fields for an outbox event.
 * Each service's outbox table must map to this interface.
 */
export interface OutboxEvent {
  id: string;
  topic: string;
  partitionKey: string;
  payload: string; // JSON-serialized event payload
  status: 'pending' | 'processing' | 'published' | 'failed';
  retryCount: number;
  nextRetryAt?: Date;
  lastError?: string;
  createdAt: Date;
  publishedAt?: Date;
}

