import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '@escrowly/kafka-core';
import { OutboxAdapter } from '../interfaces/outbox-adapter.interface';
import { OutboxEvent } from '../interfaces/outbox-event.interface';
import { PublisherConfig } from '../interfaces/publisher-config.interface';

/**
 * Outbox Processor Service
 *
 * Core service that polls the outbox table and publishes events to Kafka.
 * Handles retry logic, exponential backoff, and failure recovery.
 *
 * Features:
 * - Polls outbox at configurable interval
 * - Uses database-level locking for safe concurrent processing
 * - Exponential backoff for retries
 * - Graceful shutdown
 * - Observable (structured logging)
 */
@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private shouldStop = false;

  // Configuration with defaults
  private readonly pollingIntervalMs: number;
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(
    private readonly adapter: OutboxAdapter,
    private readonly kafka: KafkaService,
    private readonly config: PublisherConfig = {},
  ) {
    this.pollingIntervalMs = config.pollingIntervalMs ?? 2000;
    this.batchSize = config.batchSize ?? 20;
    this.maxRetries = config.maxRetries ?? 5;
    this.baseBackoffMs = config.baseBackoffMs ?? 5000;
    this.maxBackoffMs = config.maxBackoffMs ?? 60000;
  }

  async onModuleInit(): Promise<void> {
    if (!this.kafka.isEnabled) {
      console.log("Kafka", this.kafka.isEnabled);
      this.logger.warn('Kafka is disabled, outbox processor will not start');
      return;
    }
    this.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.shouldStop = true;
    this.stop();
    // Wait for current processing to finish
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.logger.log('Outbox processor stopped');
  }

  /**
   * @deprecated Immediate triggering is disabled. Processing runs on interval only.
   */
  async trigger(): Promise<void> {
    // No-op: processing runs only on the polling interval
  }

  private start(): void {
    if (this.timer || this.shouldStop) return;
    this.timer = setInterval(() => {
      this.processBatch().catch((err) =>
        this.logger.error(`Outbox batch processing failed: ${err.message}`, err.stack),
      );
    }, this.pollingIntervalMs);
    this.logger.log(
      `Outbox processor started (polling every ${this.pollingIntervalMs}ms, batch size: ${this.batchSize})`,
    );
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async processBatch(): Promise<void> {
    // Don't process if Kafka is disabled
    // if (!this.kafka.isEnabled) {
    //   return;
    // }
    if (this.isProcessing || this.shouldStop) return;
    this.isProcessing = true;

    try {
      // Find pending events (adapter handles locking)
      let events: OutboxEvent[];
      try {
        events = await this.adapter.findPendingEvents(this.batchSize);
      } catch (dbError: any) {
        this.logger.error(
          `Database error fetching outbox events: ${dbError.message}`,
          dbError.stack,
        );
        this.isProcessing = false;
        return;
      }

      if (!events.length) {
        this.isProcessing = false;
        return;
      }

      this.logger.debug(`Processing ${events.length} outbox event(s)`);

      // Process each event
      for (const event of events) {
        if (this.shouldStop) {
          this.logger.log('Stopping processing due to shutdown signal');
          break;
        }

        await this.processEvent(event);
      }
    } catch (error: any) {
      this.logger.error(`Unexpected error in batch processing: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: OutboxEvent): Promise<void> {
    try {
      // Parse payload (may fail if corrupted)
      let payload: any;
      try {
        payload = JSON.parse(event.payload);
      } catch (parseError: any) {
        this.logger.error(
          `Failed to parse outbox payload ${event.id}: ${parseError.message}`,
        );
        // Mark as permanently failed (can't retry corrupted data)
        await this.adapter.markPermanentlyFailed(
          event.id,
          `Invalid JSON payload: ${parseError.message}`,
          event.retryCount,
        );
        return;
      }

      // Check if already published (defense in depth)
      if (event.status === 'published') {
        this.logger.warn(`Event ${event.id} already published, skipping`);
        return;
      }

      // Check if Kafka is enabled before attempting to publish
      if (!this.kafka.isEnabled) {
        this.logger.debug(`Kafka disabled, event ${event.id} remains pending`);
        return; // Leave status as 'pending' - don't mark as published
      }

      // Publish to Kafka
      const result = await this.kafka.produce(event.topic, payload, event.partitionKey);

      // If Kafka returns null (disabled or failed), treat as failure
      if (result === null) {
        const retryCount = event.retryCount + 1;
        const backoffMs = this.calculateBackoff(retryCount);
        const nextRetryAt = new Date(Date.now() + backoffMs);
        
        this.logger.warn(
          `Kafka produce returned null for ${event.topic} (${event.id}), retry ${retryCount}/${this.maxRetries}. Next retry at ${nextRetryAt.toISOString()}`,
        );
        
        if (retryCount >= this.maxRetries) {
          await this.adapter.markPermanentlyFailed(event.id, 'Kafka disabled or unavailable', retryCount);
        } else {
          await this.adapter.markFailed(event.id, 'Kafka disabled or unavailable', retryCount, nextRetryAt);
        }
        return;
      }

      // Mark as published
      try {
        await this.adapter.markPublished(event.id);
        this.logger.debug(`Published event ${event.id} to topic ${event.topic}`);
      } catch (dbError: any) {
        // Published to Kafka but DB update failed - log and continue
        // Event is already in Kafka, so it's partially successful
        this.logger.error(
          `Published to Kafka but DB update failed for ${event.id}: ${dbError.message}`,
        );
        // Don't retry - event is already published
      }
    } catch (err: any) {
      // Infrastructure error (Kafka down, network, etc.)
      const retryCount = event.retryCount + 1;
      const isExhausted = retryCount >= this.maxRetries;
      const errorMessage = err?.message || 'Unknown error';
      const errorType = this.classifyError(err);

      if (isExhausted) {
        this.logger.error(
          `Outbox publish failed (giving up) ${event.topic} (${event.id}) [${errorType}]: ${errorMessage}`,
        );
        await this.adapter.markPermanentlyFailed(event.id, errorMessage, retryCount);
        return;
      }

      // Calculate exponential backoff
      const backoffMs = this.calculateBackoff(retryCount);
      const nextRetryAt = new Date(Date.now() + backoffMs);

      this.logger.warn(
        `Outbox publish failed (retry ${retryCount}/${this.maxRetries}) ${event.topic} (${event.id}) [${errorType}]: ${errorMessage}. Next retry at ${nextRetryAt.toISOString()}`,
      );

      try {
        await this.adapter.markFailed(event.id, errorMessage, retryCount, nextRetryAt);
      } catch (dbError: any) {
        // DB error while updating retry - log but don't fail the batch
        this.logger.error(`DB error updating retry for ${event.id}: ${dbError.message}`);
      }
    }
  }

  private classifyError(error: any): string {
    const message = error?.message?.toLowerCase() || '';
    if (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('enotfound') ||
      message.includes('econnrefused')
    ) {
      return 'INFRASTRUCTURE';
    }
    if (
      message.includes('database') ||
      message.includes('prisma') ||
      message.includes('query')
    ) {
      return 'DATABASE';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION';
    }
    return 'UNKNOWN';
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: baseBackoffMs * 2^retryCount, capped at maxBackoffMs
    const delay = this.baseBackoffMs * Math.pow(2, retryCount);
    return Math.min(delay, this.maxBackoffMs);
  }
}

