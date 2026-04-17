import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  KafkaService,
  BaseEvent,
  InquiryTopics,
  EscrowTopics,
  AuthTopics,
  WalletTopics,
  InquiryMessageAddedPayload,
  InquiryResolvedPayload,
  EscrowCreatedPayload,
  EscrowCompletedPayload,
  DisputeOpenedPayload,
  PasswordChangedPayload,
  UserUpdatedPayload,
} from "@escrowly/kafka-core";
import { NotificationsService } from "../notifications";

/**
 * Notification Consumer Service
 *
 * Reliable event ingestion from Kafka.
 *
 * Responsibilities:
 * - Consume Kafka events
 * - Extract event_key
 * - Call NotificationsService
 *
 * Rules:
 * - No business logic here
 * - Consumer is thin
 */
@Injectable()
export class NotificationConsumerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumerService.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.kafka.isEnabled) {
      this.logger.warn("⚠️ Kafka is disabled - consumer not starting");
      return;
    }

    // Subscribe to all relevant topics
    this.subscribeToInquiryEvents();
    this.subscribeToEscrowEvents();
    this.subscribeToAuthEvents();
    this.subscribeToWalletEvents();

    // Start consuming
    try {
      await this.kafka.startConsuming();
      this.logger.log("📥 Notification Consumer started");
    } catch (error: any) {
      // Don't crash the app if Kafka is unavailable
      this.logger.error(
        `⚠️ Failed to start Kafka consumer: ${error.message}. Consumer will not process events until Kafka is available.`
      );
    }
  }

  /**
   * Subscribe to inquiry events
   */
  private subscribeToInquiryEvents(): void {
    // inquiry.message.added - notify opposite party
    this.kafka.subscribe<InquiryMessageAddedPayload>(
      InquiryTopics.MESSAGE_ADDED,
      async (event: BaseEvent<InquiryMessageAddedPayload>) => {
        await this.handleEvent(event);
      }
    );

    // inquiry.resolved - notify buyer + seller
    this.kafka.subscribe<InquiryResolvedPayload>(
      InquiryTopics.INQUIRY_RESOLVED,
      async (event: BaseEvent<InquiryResolvedPayload>) => {
        await this.handleEvent(event);
      }
    );

    this.logger.log("Subscribed to inquiry events");
  }

  /**
   * Subscribe to escrow events
   */
  private subscribeToEscrowEvents(): void {
    // escrow.created - notify buyer + seller
    this.kafka.subscribe<EscrowCreatedPayload>(
      EscrowTopics.CREATED,
      async (event: BaseEvent<EscrowCreatedPayload>) => {
        await this.handleEvent(event);
      }
    );

    // escrow.completed - notify seller
    this.kafka.subscribe<EscrowCompletedPayload>(
      EscrowTopics.COMPLETED,
      async (event: BaseEvent<EscrowCompletedPayload>) => {
        await this.handleEvent(event);
      }
    );

    // escrow.disputed - notify buyer + seller
    this.kafka.subscribe<DisputeOpenedPayload>(
      EscrowTopics.DISPUTED,
      async (event: BaseEvent<DisputeOpenedPayload>) => {
        await this.handleEvent(event);
      }
    );

    this.logger.log("Subscribed to escrow events");
  }

  /**
   * Subscribe to auth events
   */
  private subscribeToAuthEvents(): void {
    // auth.password.changed - notify user
    this.kafka.subscribe<PasswordChangedPayload>(
      AuthTopics.PASSWORD_CHANGED,
      async (event: BaseEvent<PasswordChangedPayload>) => {
        await this.handleEvent(event);
      }
    );

    // auth.user.updated (for email updates) - notify user
    this.kafka.subscribe<UserUpdatedPayload>(
      AuthTopics.USER_UPDATED,
      async (event: BaseEvent<UserUpdatedPayload>) => {
        // Only process if email was updated
        // Note: Check payload structure - may need to adjust based on actual UserUpdatedPayload schema
        await this.handleEvent(event);
      }
    );

    this.logger.log("Subscribed to auth events");
  }

  /**
   * Subscribe to wallet events
   */
  private subscribeToWalletEvents(): void {
    // wallet.events - generic wallet events topic
    // Individual event types (wallet.deposit.completed, etc.) are in the event metadata
    this.kafka.subscribe<unknown>(
      WalletTopics.EVENTS,
      async (event: BaseEvent<unknown>) => {
        await this.handleEvent(event);
      }
    );

    this.logger.log("Subscribed to wallet events");
  }

  /**
   * Handle incoming event
   */
  private async handleEvent(event: BaseEvent<unknown>): Promise<void> {
    const eventKey = event.metadata.eventId;
    const eventType = event.metadata.eventType;

    this.logger.debug(`Received event ${eventKey} of type ${eventType}`);

    try {
      await this.notificationsService.processEvent(event);
    } catch (error) {
      // Log error but don't throw - let Kafka handle retries
      this.logger.error(
        `Failed to process event ${eventKey}: ${error}`,
        (error as Error).stack
      );
      // In production, you might want to send to DLQ here
    }
  }
}

