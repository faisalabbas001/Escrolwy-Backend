/**
 * Publisher Configuration Interface
 *
 * Configuration options for the outbox processor.
 */
export interface PublisherConfig {
  /**
   * Polling interval in milliseconds
   * @default 2000
   */
  pollingIntervalMs?: number;

  /**
   * Maximum number of events to process per batch
   * @default 20
   */
  batchSize?: number;

  /**
   * Maximum number of retry attempts before giving up
   * @default 5
   */
  maxRetries?: number;

  /**
   * Base backoff delay in milliseconds for exponential backoff
   * @default 5000
   */
  baseBackoffMs?: number;

  /**
   * Maximum backoff delay in milliseconds (caps exponential backoff)
   * @default 60000
   */
  maxBackoffMs?: number;

  /**
   * Enable metrics collection (optional)
   * @default false
   */
  enableMetrics?: boolean;
}

