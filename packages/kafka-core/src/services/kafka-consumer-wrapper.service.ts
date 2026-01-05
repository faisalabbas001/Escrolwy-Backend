import { Injectable, Logger } from '@nestjs/common';
import { KafkaService, AllTopics, BaseEvent } from '../index';
import { EachMessagePayload } from 'kafkajs';

export interface ConsumerWrapperConfig {
  maxRetries?: number; // default 3
  retryDelayMs?: number; // default 1000
  dlqTopicSuffix?: string; // default '.dlq'
  enableIdempotency?: boolean; // default true
  classifyError?: (error: unknown) => 'BUSINESS' | 'TRANSIENT' | 'UNKNOWN';
}

export type WrappedEventHandler<T = unknown> = (
  event: BaseEvent<T>,
  raw: EachMessagePayload,
) => Promise<void>;

/**
 * Consumer Wrapper Service
 *
 * Wraps Kafka consumers with:
 * - Idempotency (prevents duplicate processing)
 * - Retry logic (transient failures)
 * - DLQ (dead letter queue for permanent failures)
 *
 * Requires a processed_events table in your service DB.
 */
@Injectable()
export class KafkaConsumerWrapperService {
  private readonly logger = new Logger(KafkaConsumerWrapperService.name);
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly dlqTopicSuffix: string;
  private readonly enableIdempotency: boolean;

  constructor(
    private readonly kafka: KafkaService,
    private readonly config: ConsumerWrapperConfig = {},
  ) {
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.dlqTopicSuffix = config.dlqTopicSuffix ?? '.dlq';
    this.enableIdempotency = config.enableIdempotency ?? true;
  }

  /**
   * Subscribe with idempotency, retry, and DLQ support
   *
   * @param checkProcessed - Function to check if event was already processed (returns eventId if processed, null if new)
   * @param markProcessed - Function to mark event as processed
   * @param sendToDlq - Function to send failed event to DLQ
   */
  subscribe<T>(
    topic: AllTopics | string,
    handler: WrappedEventHandler<T>,
    checkProcessed: (eventId: string, topic: string) => Promise<boolean>,
    markProcessed: (
      eventId: string,
      topic: string,
      status: 'processed' | 'failed' | 'business_failed',
      error?: string,
    ) => Promise<void>,
    sendToDlq: (
      topic: string,
      event: BaseEvent<T>,
      error: string,
      retryCount: number,
    ) => Promise<void>,
  ): void {
    this.kafka.subscribe<T>(topic, async (event, raw) => {
      const eventId = event.metadata.eventId;
      const topicName = typeof topic === 'string' ? topic : topic;

      // Idempotency check
      if (this.enableIdempotency) {
        const isProcessed = await checkProcessed(eventId, topicName);
        if (isProcessed) {
          this.logger.debug(
            `Event ${eventId} already processed, skipping`,
          );
          return;
        }
      }

      // Retry loop
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          await handler(event, raw);
          await markProcessed(eventId, topicName, 'processed');
          this.logger.debug(
            `Event ${eventId} processed successfully (attempt ${attempt + 1})`,
          );
          return;
        } catch (error: any) {
          lastError = error;
          const classification =
            this.config.classifyError?.(error) ?? this.defaultClassify(error);
          const isBusiness = classification === 'BUSINESS';
          const isLastAttempt = attempt === this.maxRetries;

          // Business errors: don't retry, don't DLQ; mark as business_failed
          if (isBusiness) {
            this.logger.warn(
              `Event ${eventId} business failure: ${error.message}`,
            );
            await markProcessed(
              eventId,
              topicName,
              'business_failed',
              error.message,
            );
            return;
          }

          if (isLastAttempt) {
            this.logger.error(
              `Event ${eventId} failed after ${attempt + 1} attempts: ${error.message}`,
            );
            await markProcessed(
              eventId,
              topicName,
              'failed',
              error.message,
            );
            await sendToDlq(topicName, event, error.message, attempt + 1);
            return;
          }

          // Wait before retry
          await this.delay(this.retryDelayMs * Math.pow(2, attempt));
          this.logger.warn(
            `Event ${eventId} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying...`,
          );
        }
      }

      // Should never reach here, but just in case
      if (lastError) {
        await markProcessed(
          eventId,
          topicName,
          'failed',
          lastError.message,
        );
        await sendToDlq(topicName, event, lastError.message, this.maxRetries);
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private defaultClassify(error: unknown): 'BUSINESS' | 'TRANSIENT' | 'UNKNOWN' {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes('insufficient') || message.includes('validation')) {
      return 'BUSINESS';
    }
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return 'TRANSIENT';
    }
    return 'UNKNOWN';
  }
}

