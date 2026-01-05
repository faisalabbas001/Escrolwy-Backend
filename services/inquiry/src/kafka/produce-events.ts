import { Injectable, Logger } from '@nestjs/common';
import {
  InquiryTopics,
  InquiryCreatedPayload,
  InquiryClosedPayload,
  InquiryResolvedPayload,
  InquiryAssignedPayload,
  InquiryMessageAddedPayload,
  InquiryAttachmentUploadedPayload,
} from '@escrowly/kafka-core';
import { OutboxRepository } from '../inquiry/repository';

/**
 * Inquiry Event Producer
 *
 * Produces Kafka events for inquiry state changes using the Transactional Outbox Pattern.
 * Events are written to the outbox table and published to Kafka by OutboxProcessorService.
 * All methods are fire-and-forget - failures are logged but don't block.
 */
@Injectable()
export class InquiryEventProducer {
  private readonly logger = new Logger(InquiryEventProducer.name);

  constructor(private readonly outboxRepository: OutboxRepository) {}

  // ==========================================
  // LIFECYCLE EVENTS
  // ==========================================

  /**
   * Emit inquiry.created event
   */
  async inquiryCreated(
    payload: InquiryCreatedPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      InquiryTopics.INQUIRY_CREATED,
      payload.inquiry.id,
      payload,
      correlationId,
    );
  }

  /**
   * Emit inquiry.closed event
   */
  async inquiryClosed(
    payload: InquiryClosedPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      InquiryTopics.INQUIRY_CLOSED,
      payload.inquiryId,
      payload,
      correlationId,
    );
  }

  /**
   * Emit inquiry.resolved event
   */
  async inquiryResolved(
    payload: InquiryResolvedPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      InquiryTopics.INQUIRY_RESOLVED,
      payload.inquiryId,
      payload,
      correlationId,
    );
  }

  /**
   * Emit inquiry.assigned event
   */
  async inquiryAssigned(
    payload: InquiryAssignedPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      InquiryTopics.INQUIRY_ASSIGNED,
      payload.inquiryId,
      payload,
      correlationId,
    );
  }

  // ==========================================
  // MESSAGE EVENTS
  // ==========================================

  /**
   * Emit inquiry.message.added event
   */
  async messageAdded(
    payload: InquiryMessageAddedPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      InquiryTopics.MESSAGE_ADDED,
      payload.inquiryId,
      payload,
      correlationId,
    );
  }

  // ==========================================
  // ATTACHMENT EVENTS
  // ==========================================

  /**
   * Emit inquiry.attachment.uploaded event
   */
  async attachmentUploaded(
    payload: InquiryAttachmentUploadedPayload,
    correlationId?: string,
  ): Promise<void> {
    await this.produce(
      InquiryTopics.ATTACHMENT_UPLOADED,
      payload.inquiryId,
      payload,
      correlationId,
    );
  }

  // ==========================================
  // CORE PRODUCE METHOD
  // ==========================================

  /**
   * Save event to outbox table (Transactional Outbox Pattern).
   * OutboxProcessorService will pick it up and publish to Kafka.
   * Never publishes directly to Kafka - this ensures transactional consistency.
   */
  private async produce<T>(
    topic: InquiryTopics,
    partitionKey: string,
    payload: T,
    correlationId?: string,
  ): Promise<void> {
    try {
      // Save to outbox with 'pending' status
      // OutboxProcessorService will poll and publish to Kafka
      await this.outboxRepository.save(topic, partitionKey, payload, undefined, 'pending');
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
