import { BaseEvent } from "@escrowly/kafka-core";
import {
  InquiryMessageAddedPayload,
  InquiryResolvedPayload,
  EscrowCreatedPayload,
  EscrowCompletedPayload,
  DisputeOpenedPayload,
  PasswordChangedPayload,
} from "@escrowly/kafka-core";

/**
 * Wallet Deposit Completed Payload
 * 
 * Note: This type is not yet in kafka-core, so we define it locally.
 * When wallet service is implemented, this should be moved to kafka-core schemas.
 */
interface WalletDepositCompletedPayload {
  walletId: string;
  userId: string;
  amount: string | number;
  asset: string;
  transactionHash: string;
  depositedAt?: string;
  completedAt?: string;
  chain: string;
}

/**
 * Email Intent
 * Represents what email should be sent to whom
 */
export interface EmailIntent {
  userId: string;
  templateId: string;
  variables: Record<string, any>;
}

/**
 * Notification Mapper
 *
 * Translates domain events → email intent.
 *
 * Responsibilities:
 * - Convert raw events into email requests
 *
 * Rules:
 * - Mapper contains no I/O
 * - Pure functions only
 */
export class NotificationMapper {
  /**
   * Map event to email intent(s)
   *
   * @param event - Kafka event
   * @returns Array of email intents (one event may trigger multiple emails)
   */
  static mapEventToIntents(event: BaseEvent<any>): EmailIntent[] {
    const { payload, metadata } = event;
    const eventType = metadata.eventType;

    switch (eventType) {
      case "inquiry.message.added":
        return this.mapInquiryMessageAdded(
          payload as InquiryMessageAddedPayload
        );

      case "inquiry.resolved":
        return this.mapInquiryResolved(payload as InquiryResolvedPayload);

      case "escrow.created":
        return this.mapEscrowCreated(payload as EscrowCreatedPayload);

      case "escrow.completed":
        return this.mapEscrowCompleted(payload as EscrowCompletedPayload);

      case "escrow.disputed":
        return this.mapEscrowDisputed(payload as DisputeOpenedPayload);

      case "auth.password.changed":
        return this.mapPasswordChanged(payload as PasswordChangedPayload);

      case "wallet.deposit.completed":
        return this.mapWalletDepositCompleted(payload as WalletDepositCompletedPayload);

      // TODO: Add more event mappings as needed
      // case "wallet.withdrawal.completed":
      // case "wallet.withdrawal.failed":
      // case "wallet.balance.low":
      // case "auth.email.updated":

      default:
        // Unknown event type - return empty array (no emails)
        return [];
    }
  }

  /**
   * inquiry.message.added → notify all recipients (buyer, seller, admin)
   * Uses recipientIds[] from payload which excludes the sender
   */
  private static mapInquiryMessageAdded(
    payload: InquiryMessageAddedPayload
  ): EmailIntent[] {
    const intents: EmailIntent[] = [];

    // Validate recipientIds exist
    if (!payload.recipientIds || payload.recipientIds.length === 0) {
      console.warn(
        `InquiryMessageAddedPayload missing recipientIds for inquiry ${payload.inquiryId}`
      );
      return [];
    }

    // Create intent for each recipient (buyer, seller, assigned admin)
    for (const recipientId of payload.recipientIds) {
      intents.push({
        userId: recipientId,
        templateId: "inquiry_message_received_v1",
        variables: {
          inquiryId: payload.inquiryId,
          escrowId: payload.escrowId,
          senderId: payload.senderId,
          senderRole: payload.senderRole,
          senderName: `User ${payload.senderId}`, // Could be enriched later with actual name
          message: payload.message || "",
          inquiryUrl: `https://escrowly.com/inquiries/${payload.inquiryId}`,
        },
      });
    }

    return intents;
  }

  /**
   * inquiry.resolved → notify buyer + seller
   */
  private static mapInquiryResolved(
    payload: InquiryResolvedPayload
  ): EmailIntent[] {
    const intents: EmailIntent[] = [];

    const variables = {
      inquiryId: payload.inquiryId,
      escrowId: payload.escrowId,
      resolutionType: payload.resolutionType,
      resolutionNote: payload.resolutionNote || "",
      resolvedBy: payload.resolvedBy,
      resolvedAt: payload.resolvedAt,
      inquiryUrl: `https://escrowly.com/inquiries/${payload.inquiryId}`,
    };

    // ✅ Notify buyer (if buyerId is provided)
    if (payload.buyerId && payload.buyerId !== "") {
      intents.push({
        userId: payload.buyerId,
        templateId: "inquiry_resolved_v1",
        variables,
      });
    }

    // ✅ Notify seller (if sellerId is provided)
    if (payload.sellerId && payload.sellerId !== "") {
      intents.push({
        userId: payload.sellerId,
        templateId: "inquiry_resolved_v1",
        variables,
      });
    }

    // Validate at least one recipient
    if (intents.length === 0) {
      console.warn(
        `InquiryResolvedPayload missing buyerId/sellerId for inquiry ${payload.inquiryId}`
      );
    }

    return intents;
  }

  /**
   * escrow.created → notify buyer and seller
   */
  private static mapEscrowCreated(
    payload: EscrowCreatedPayload
  ): EmailIntent[] {
    const intents: EmailIntent[] = [];

    const variables = {
      escrowId: payload.escrow.id,
      amount: payload.escrow.amount,
      asset: payload.escrow.asset,
      escrowUrl: `https://escrowly.com/escrows/${payload.escrow.id}`,
    };

    // Notify buyer
    intents.push({
      userId: payload.escrow.buyerId,
      templateId: "escrow_created_v1",
      variables,
    });

    // Notify seller
    intents.push({
      userId: payload.escrow.sellerId,
      templateId: "escrow_created_v1",
      variables,
    });

    return intents;
  }

  /**
   * escrow.completed → notify seller
   */
  private static mapEscrowCompleted(
    payload: EscrowCompletedPayload
  ): EmailIntent[] {
    return [
      {
        userId: payload.sellerId,
        templateId: "escrow_completed_v1",
        variables: {
          escrowId: payload.escrowId,
          amount: payload.amount,
          asset: payload.asset,
          completedAt: payload.completedAt,
          escrowUrl: `https://escrowly.com/escrows/${payload.escrowId}`,
        },
      },
    ];
  }

  /**
   * escrow.disputed → notify buyer and seller
   */
  private static mapEscrowDisputed(
    payload: DisputeOpenedPayload
  ): EmailIntent[] {
    const variables = {
      escrowId: payload.escrowId,
      reason: payload.reason,
      escrowUrl: `https://escrowly.com/escrows/${payload.escrowId}`,
    };

    return [
      {
        userId: payload.buyerId,
        templateId: "escrow_disputed_v1",
        variables,
      },
      {
        userId: payload.sellerId,
        templateId: "escrow_disputed_v1",
        variables,
      },
    ];
  }

  /**
   * auth.password.changed → notify user
   */
  private static mapPasswordChanged(
    payload: PasswordChangedPayload
  ): EmailIntent[] {
    return [
      {
        userId: payload.userId,
        templateId: "password_changed_v1",
        variables: {
          changedAt: payload.changedAt,
        },
      },
    ];
  }

  /**
   * wallet.deposit.completed → notify wallet owner
   */
  private static mapWalletDepositCompleted(
    payload: WalletDepositCompletedPayload
  ): EmailIntent[] {
    return [
      {
        userId: payload.userId,
        templateId: "wallet_deposit_completed_v1",
        variables: {
          amount: payload.amount,
          asset: payload.asset,
          transactionHash: payload.transactionHash,
          completedAt: payload.depositedAt || payload.completedAt,
          walletUrl: `https://escrowly.com/wallet`,
          // Include recipientEmail if provided (for testing or when available in payload)
          recipientEmail: (payload as any).recipientEmail,
        },
      },
    ];
  }
}

