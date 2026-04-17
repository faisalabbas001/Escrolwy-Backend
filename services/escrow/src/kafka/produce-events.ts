import { Injectable, Logger } from '@nestjs/common';
import {
  EscrowTopics,
  EscrowSnapshot,
  EscrowCreatedPayload,
  EscrowAcceptedPayload,
  PaymentCompletedPayload,
  DeliveryStartedPayload,
  InspectionCompletedPayload,
  InspectionStartedPayload,
  EscrowCompletedPayload,
  EscrowRefundedPayload,
  EscrowCancelledPayload,
  DisputeOpenedPayload,
  DisputeResolvedPayload,
  ForceClosedPayload,
  EscrowReminderPayload,
} from '@escrowly/kafka-core';
import { OutboxRepository } from '../modules/escrows/repository';

/**
 * Escrow Event Producer
 *
 * Produces Kafka events for escrow state changes using the Transactional Outbox Pattern.
 * Events are written to the outbox table and published to Kafka by OutboxProcessorService.
 * All methods are fire-and-forget - failures are logged but don't block.
 */
@Injectable()
export class EscrowEventProducer {
  private readonly logger = new Logger(EscrowEventProducer.name);

  constructor(private readonly outboxRepository: OutboxRepository) {}

  // ==========================================
  // LIFECYCLE EVENTS
  // ==========================================

  async escrowCreated(
    escrow: EscrowSnapshot,
    initiatedBy: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowCreatedPayload = { escrow, initiatedBy };
    await this.produce(EscrowTopics.CREATED, escrow.id, payload, correlationId);
  }

  async escrowAccepted(
    escrowId: string,
    acceptedBy: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    asset: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowAcceptedPayload = {
      escrowId,
      acceptedBy,
      buyerId,
      sellerId,
      amount,
      asset,
    };
    await this.produce(EscrowTopics.ACCEPTED, escrowId, payload, correlationId);
  }

  async paymentCompleted(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    asset: string,
    chain: string,
    transactionHash?: string,
    correlationId?: string,
    feeBreakdown?: { buyerFee?: number; sellerFee?: number; buyerAmount?: number },
  ): Promise<void> {
    const payload: PaymentCompletedPayload & {
      buyerFee?: number;
      sellerFee?: number;
      buyerAmount?: number;
    } = {
      escrowId,
      buyerId,
      sellerId,
      amount,
      asset,
      chain,
      transactionHash,
      ledgerAction: 'reserve_funds',
      buyerFee: feeBreakdown?.buyerFee ?? 0,
      sellerFee: feeBreakdown?.sellerFee ?? 0,
      buyerAmount: feeBreakdown?.buyerAmount ?? amount,
    };
    await this.produce(EscrowTopics.PAYMENT_COMPLETED, escrowId, payload, correlationId);
  }

  async deliveryStarted(
    escrowId: string,
    sellerId: string,
    buyerId: string,
    deliveryProof: string,
    notes?: string,
    inspectionDeadline?: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: DeliveryStartedPayload = {
      escrowId,
      sellerId,
      buyerId,
      deliveryProof,
      notes,
      inspectionDeadline,
    };
    await this.produce(EscrowTopics.DELIVERY_STARTED, escrowId, payload, correlationId);
  }

  async inspectionStarted(
    escrowId: string,
    sellerId: string,
    buyerId: string,
    inspectionDeadline: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: InspectionStartedPayload = {
      escrowId,
      sellerId,
      buyerId,
      inspectionDeadline,
    };
    await this.produce(EscrowTopics.INSPECTION_STARTED, escrowId, payload, correlationId);
  }

  async inspectionCompleted(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    status: 'accepted' | 'rejected',
    inspectionNotes: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: InspectionCompletedPayload = {
      escrowId,
      buyerId,
      sellerId,
      status,
      inspectionNotes,
      ledgerAction: status === 'accepted' ? 'release_to_seller' : undefined,
    };
    await this.produce(EscrowTopics.INSPECTION_COMPLETED, escrowId, payload, correlationId);
  }

  async escrowCompleted(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    asset: string,
    chain: string,
    platformFee: number,
    buyerFee: number,
    sellerFee: number,
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowCompletedPayload = {
      escrowId,
      buyerId,
      sellerId,
      amount,
      asset,
      chain,
      platformFee,
      buyerFee,
      sellerFee,
      completedAt: new Date().toISOString(),
      ledgerAction: 'release_to_seller',
    };
    await this.produce(EscrowTopics.COMPLETED, escrowId, payload, correlationId);
  }

  async escrowRefunded(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    asset: string,
    chain: string,
    reason: string,
    refundedBy: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowRefundedPayload = {
      escrowId,
      buyerId,
      sellerId,
      amount,
      asset,
      chain,
      reason,
      refundedBy,
      ledgerAction: 'refund_to_buyer',
    };
    await this.produce(EscrowTopics.REFUNDED, escrowId, payload, correlationId);
  }

  async escrowCancelled(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    cancelledBy: string,
    reason: string,
    previousState: string,
    hasFunds: boolean,
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowCancelledPayload = {
      escrowId,
      buyerId,
      sellerId,
      cancelledBy,
      reason,
      previousState,
      ledgerAction: hasFunds ? 'refund_to_buyer' : undefined,
    };
    await this.produce(EscrowTopics.CANCELLED, escrowId, payload, correlationId);
  }

  // ==========================================
  // DISPUTE EVENTS
  // ==========================================

  async disputeOpened(
    escrowId: string,
    disputedBy: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    asset: string,
    reason: string,
    previousState: string,
    evidence?: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: DisputeOpenedPayload = {
      escrowId,
      disputedBy,
      buyerId,
      sellerId,
      amount,
      asset,
      reason,
      evidence,
      previousState,
      ledgerAction: 'freeze_funds',
    };
    await this.produce(EscrowTopics.DISPUTED, escrowId, payload, correlationId);
  }

  async disputeResolved(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    asset: string,
    chain: string,
    resolution: 'buyer_wins' | 'seller_wins' | 'refund',
    resolvedBy: string,
    adminNotes: string,
    correlationId?: string,
  ): Promise<void> {
    const ledgerAction =
      resolution === 'seller_wins' ? 'release_to_seller' : 'refund_to_buyer';

    const payload: DisputeResolvedPayload = {
      escrowId,
      buyerId,
      sellerId,
      amount,
      asset,
      chain,
      resolution,
      resolvedBy,
      adminNotes,
      ledgerAction,
    };
    await this.produce(EscrowTopics.RESOLVED, escrowId, payload, correlationId);
  }

  // ==========================================
  // ADMIN EVENTS
  // ==========================================

  async forceClosed(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    closedBy: string,
    reason: string,
    previousState: string,
    fundsAction: 'refund_buyer' | 'release_seller' | 'no_action',
    correlationId?: string,
  ): Promise<void> {
    let ledgerAction: 'release_to_seller' | 'refund_to_buyer' | undefined;
    if (fundsAction === 'refund_buyer') ledgerAction = 'refund_to_buyer';
    if (fundsAction === 'release_seller') ledgerAction = 'release_to_seller';

    const payload: ForceClosedPayload = {
      escrowId,
      buyerId,
      sellerId,
      amount,
      closedBy,
      reason,
      previousState,
      fundsAction,
      ledgerAction,
    };
    await this.produce(EscrowTopics.FORCE_CLOSED, escrowId, payload, correlationId);
  }

  // ==========================================
  // REMINDER EVENTS
  // ==========================================

  async reminderAccept(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    brokerId: string | undefined,
    currentState: string,
    elapsedHours: number,
    notifiedUserIds: string[],
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowReminderPayload = {
      escrowId,
      buyerId,
      sellerId,
      brokerId,
      currentState,
      elapsedHours,
      reminderType: 'accept',
      notifiedUserIds,
    };
    await this.produce(EscrowTopics.REMINDER_ACCEPT, escrowId, payload, correlationId);
  }

  async reminderFund(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    brokerId: string | undefined,
    currentState: string,
    elapsedHours: number,
    notifiedUserIds: string[],
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowReminderPayload = {
      escrowId,
      buyerId,
      sellerId,
      brokerId,
      currentState,
      elapsedHours,
      reminderType: 'fund',
      notifiedUserIds,
    };
    await this.produce(EscrowTopics.REMINDER_FUND, escrowId, payload, correlationId);
  }

  async reminderDeliver(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    brokerId: string | undefined,
    currentState: string,
    elapsedHours: number,
    notifiedUserIds: string[],
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowReminderPayload = {
      escrowId,
      buyerId,
      sellerId,
      brokerId,
      currentState,
      elapsedHours,
      reminderType: 'deliver',
      notifiedUserIds,
    };
    await this.produce(EscrowTopics.REMINDER_DELIVER, escrowId, payload, correlationId);
  }

  async reminderInspect(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    brokerId: string | undefined,
    currentState: string,
    elapsedHours: number,
    notifiedUserIds: string[],
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowReminderPayload = {
      escrowId,
      buyerId,
      sellerId,
      brokerId,
      currentState,
      elapsedHours,
      reminderType: 'inspect',
      notifiedUserIds,
    };
    await this.produce(EscrowTopics.REMINDER_INSPECT, escrowId, payload, correlationId);
  }

  async reminderComplete(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    brokerId: string | undefined,
    currentState: string,
    elapsedHours: number,
    notifiedUserIds: string[],
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowReminderPayload = {
      escrowId,
      buyerId,
      sellerId,
      brokerId,
      currentState,
      elapsedHours,
      reminderType: 'complete',
      notifiedUserIds,
    };
    await this.produce(EscrowTopics.REMINDER_COMPLETE, escrowId, payload, correlationId);
  }

  async reminderDispute(
    escrowId: string,
    buyerId: string,
    sellerId: string,
    brokerId: string | undefined,
    currentState: string,
    elapsedHours: number,
    notifiedUserIds: string[],
    correlationId?: string,
  ): Promise<void> {
    const payload: EscrowReminderPayload = {
      escrowId,
      buyerId,
      sellerId,
      brokerId,
      currentState,
      elapsedHours,
      reminderType: 'dispute',
      notifiedUserIds,
    };
    await this.produce(EscrowTopics.REMINDER_DISPUTE, escrowId, payload, correlationId);
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
    topic: EscrowTopics,
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

