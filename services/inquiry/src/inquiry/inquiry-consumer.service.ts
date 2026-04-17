import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  KafkaService,
  EscrowTopics,
  BaseEvent,
  DisputeOpenedPayload,
  DisputeResolvedPayload,
  InquiryCreatedPayload,
} from "@escrowly/kafka-core";
import { PrismaService } from "../prisma";
import { InquiryEventProducer } from "../kafka";

/**
 * Inquiry Consumer Service
 *
 * Handles incoming Kafka events from other services.
 * This allows the inquiry service to react to events like:
 * - Dispute opened on an escrow → Auto-create inquiry
 * - Dispute resolved → Auto-close related inquiry
 *
 * Features:
 * - Subscribes to relevant topics on module init
 * - Processes events asynchronously
 * - Handles errors gracefully
 */
@Injectable()
export class InquiryConsumerService implements OnModuleInit {
  private readonly logger = new Logger(InquiryConsumerService.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly prisma: PrismaService,
    private readonly eventProducer: InquiryEventProducer
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.kafka.isEnabled) {
      this.logger.warn("⚠️ Kafka is disabled - consumer not starting");
      return;
    }

    // Subscribe to escrow dispute events
    this.subscribeToDisputeEvents();

    // Start consuming - wrap in try-catch to prevent app crash if Kafka is down
    try {
      await this.kafka.startConsuming();
      this.logger.log("📥 Inquiry Consumer started");
    } catch (error: any) {
      // Don't crash the app if Kafka is unavailable
      // The consumer will not work, but the app can still serve HTTP requests
      // and the outbox processor can still queue events for later delivery
      this.logger.error(
        `⚠️ Failed to start Kafka consumer: ${error.message}. Consumer will not process events until Kafka is available.`,
      );
    }
  }

  /**
   * Subscribe to dispute-related events
   */
  private subscribeToDisputeEvents(): void {
    // When a dispute is opened, we may want to auto-create an inquiry
    this.kafka.subscribe<DisputeOpenedPayload>(
      EscrowTopics.DISPUTED,
      async (event: BaseEvent<DisputeOpenedPayload>) => {
        await this.handleDisputeOpened(event);
      }
    );

    // When a dispute is resolved, we may want to update/close related inquiry
    this.kafka.subscribe<DisputeResolvedPayload>(
      EscrowTopics.RESOLVED,
      async (event: BaseEvent<DisputeResolvedPayload>) => {
        await this.handleDisputeResolved(event);
      }
    );

    this.logger.log("Subscribed to dispute events");
  }

  /**
   * Handle dispute opened event
   * Auto-creates an inquiry for the disputed escrow if one doesn't exist
   */
  private async handleDisputeOpened(
    event: BaseEvent<DisputeOpenedPayload>
  ): Promise<void> {
    const { payload, metadata } = event;

    this.logger.log(
      `Processing dispute opened event for escrow ${payload.escrowId}`
    );

    try {
      // Check if inquiry already exists
      const existingInquiry = await this.prisma.inquiries.findUnique({
        where: { escrow_id: payload.escrowId },
      });

      if (existingInquiry) {
        this.logger.debug(
          `Inquiry already exists for escrow ${payload.escrowId}`
        );
        return;
      }

      // Auto-create inquiry for the dispute
      // Store buyerId/sellerId from DisputeOpenedPayload to avoid future escrow service calls
      const inquiry = await this.prisma.$transaction(async (tx) => {
        const newInquiry = await tx.inquiries.create({
          data: {
            escrow_id: payload.escrowId,
            created_by: payload.disputedBy,
            buyer_id: payload.buyerId || null,
            seller_id: payload.sellerId || null,
            status: "open",
          },
        });

        // Add initial message about the dispute
        await tx.inquiry_messages.create({
          data: {
            inquiry_id: newInquiry.id,
            sender_id: "system",
            sender_role: "admin",
            message: `[SYSTEM] Dispute opened: ${payload.reason}${
              payload.evidence ? `\n\nEvidence: ${payload.evidence}` : ""
            }`,
          },
        });

        return newInquiry;
      });

      // Emit inquiry.created event via outbox (fire-and-forget)
      const eventPayload: InquiryCreatedPayload = {
        inquiry: {
          id: inquiry.id,
          escrowId: inquiry.escrow_id,
          createdBy: inquiry.created_by,
          assignedAdminId: inquiry.assigned_admin_id || undefined,
          status: inquiry.status,
          createdAt: inquiry.created_at.toISOString(),
          updatedAt: inquiry.updated_at.toISOString(),
        },
        initialMessage: undefined,
        createdBy: payload.disputedBy,
      };
      await this.eventProducer.inquiryCreated(eventPayload);

      this.logger.log(
        `✅ Auto-created inquiry ${inquiry.id} for disputed escrow ${payload.escrowId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle dispute opened event: ${error}`,
        (error as Error).stack
      );
    }
  }

  /**
   * Handle dispute resolved event
   * Updates the related inquiry status
   */
  private async handleDisputeResolved(
    event: BaseEvent<DisputeResolvedPayload>
  ): Promise<void> {
    const { payload, metadata } = event;

    this.logger.log(
      `Processing dispute resolved event for escrow ${payload.escrowId}`
    );

    try {
      // Find related inquiry
      const inquiry = await this.prisma.inquiries.findUnique({
        where: { escrow_id: payload.escrowId },
      });

      if (!inquiry) {
        this.logger.debug(
          `No inquiry found for escrow ${payload.escrowId} - skipping`
        );
        return;
      }

      // Update inquiry with resolution
      await this.prisma.$transaction(async (tx) => {
        // Add resolution message
        await tx.inquiry_messages.create({
          data: {
            inquiry_id: inquiry.id,
            sender_id: payload.resolvedBy,
            sender_role: "admin",
            message: `[DISPUTE RESOLVED] Resolution: ${payload.resolution}\n\nAdmin Notes: ${payload.adminNotes}`,
          },
        });

        // Close the inquiry
        await tx.inquiries.update({
          where: { id: inquiry.id },
          data: { status: "closed" },
        });
      });

      this.logger.log(
        `✅ Updated inquiry ${inquiry.id} after dispute resolution`
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle dispute resolved event: ${error}`,
        (error as Error).stack
      );
    }
  }
}



