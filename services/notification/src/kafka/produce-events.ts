import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationTopics,
  NotificationSentPayload,
  NotificationDeliveryFailedPayload,
} from "@escrowly/kafka-core";
import { OutboxRepository } from "./outbox.repository";

/**
 * Notification Event Producer
 *
 * Produces Kafka events for notification state changes using the Transactional Outbox Pattern.
 * Events are written to the outbox table and published to Kafka by OutboxProcessorService.
 * All methods are fire-and-forget - failures are logged but don't block.
 */
@Injectable()
export class NotificationEventProducer {
  private readonly logger = new Logger(NotificationEventProducer.name);

  constructor(private readonly outboxRepository: OutboxRepository) {}

  /**
   * Emit notification.sent event
   */
  async notificationSent(
    payload: NotificationSentPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      NotificationTopics.EMAIL_SENT,
      payload.notificationId,
      payload,
      correlationId,
    );
  }

  /**
   * Emit notification.delivery.failed event
   */
  async notificationDeliveryFailed(
    payload: NotificationDeliveryFailedPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      NotificationTopics.EMAIL_FAILED,
      payload.notificationId,
      payload,
      correlationId,
    );
  }

  /**
   * Save event to outbox table (Transactional Outbox Pattern).
   * OutboxProcessorService will pick it up and publish to Kafka.
   * Never publishes directly to Kafka - this ensures transactional consistency.
   */
  private async produce<T>(
    topic: NotificationTopics,
    partitionKey: string,
    payload: T,
    correlationId?: string,
  ): Promise<void> {
    try {
      // Save to outbox with 'pending' status
      // OutboxProcessorService will poll and publish to Kafka
      await this.outboxRepository.save(topic, partitionKey, payload, undefined, "pending");
      this.logger.debug(`Saved ${topic} to outbox for ${partitionKey}`);
    } catch (error: any) {
      // Log but don't throw - event production shouldn't block business logic
      this.logger.error(
        `Failed to save ${topic} to outbox for ${partitionKey}: ${error.message}`,
        error.stack,
      );
    }
  }
}

