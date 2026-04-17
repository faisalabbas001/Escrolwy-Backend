import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { PublisherService } from "@escrowly/kafka-publisher";

/**
 * Outbox Repository
 *
 * Persists events to the transactional outbox (outbox_events table) so they
 * can be retried by a background publisher when Kafka is unavailable.
 */
@Injectable()
export class OutboxRepository {
  private readonly logger = new Logger(OutboxRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly publisher?: PublisherService,
  ) {}

  /**
   * Save a failed (or pending) event to the outbox for later publishing.
   */
  async save(
    topic: string,
    partitionKey: string,
    payload: unknown,
    lastError?: string,
    status: "pending" | "failed" = "failed",
  ): Promise<void> {
    try {
      await this.prisma.outboxEvent.create({
        data: {
          topic,
          partitionKey,
          payload: JSON.stringify(payload),
          status,
          lastError,
          // retryCount, nextRetryAt left to publisher/backoff policy
        },
      });

      // Trigger publisher to process immediately (non-blocking)
      if (this.publisher) {
        this.publisher.triggerProcessing().catch((err: any) =>
          this.logger.debug(`Failed to trigger publisher: ${err.message}`),
        );
      }
    } catch (error: any) {
      // Do not throw from outbox persistence; log and proceed
      this.logger.error(
        `Failed to persist outbox event for ${topic}:${partitionKey} - ${error.message}`,
      );
    }
  }
}

