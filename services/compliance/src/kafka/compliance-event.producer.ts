import { Injectable, Logger } from '@nestjs/common';
import { ComplianceTopics } from '@escrowly/kafka-core';
import { OutboxRepository } from '../kyc/outbox.repository';

/**
 * Compliance Event Producer
 *
 * Produces Kafka events for compliance state changes using the Transactional Outbox Pattern.
 * Events are written to the outbox table and published to Kafka by OutboxProcessorService.
 * All methods are fire-and-forget - failures are logged but don't block.
 *
 * Architecture matches Auth Service pattern for consistency.
 */
@Injectable()
export class ComplianceEventProducer {
    private readonly logger = new Logger(ComplianceEventProducer.name);

    constructor(private readonly outboxRepository: OutboxRepository) { }

    // ==========================================
    // KYC EVENTS
    // ==========================================

    /**
     * Emit kyc.started event
     */
    async kycStarted(
        userId: string,
        inquiryId: string,
        referenceId?: string,
    ): Promise<void> {
        const payload = {
            userId,
            inquiryId,
            referenceId,
            startedAt: new Date().toISOString(),
        };

        await this.produce(ComplianceTopics.KYC_STARTED, userId, payload);
    }

    /**
     * Emit kyc.approved event
     */
    async kycApproved(
        userId: string,
        inquiryId: string,
        limits: { escrowLimit: number; ledgerLimit: number },
    ): Promise<void> {
        const payload = {
            userId,
            inquiryId,
            state: 'VERIFIED',
            providerRef: inquiryId,
            limits,
            at: new Date().toISOString(),
        };

        // Also emit to the generic events topic for Auth service consumption
        await this.produce(ComplianceTopics.KYC_APPROVED, userId, payload);
        await this.produceKycUpdated(userId, 'VERIFIED', inquiryId);
    }

    /**
     * Emit kyc.rejected event
     */
    async kycRejected(
        userId: string,
        inquiryId: string,
        reason?: string,
    ): Promise<void> {
        const payload = {
            userId,
            inquiryId,
            state: 'REJECTED',
            providerRef: inquiryId,
            reason,
            at: new Date().toISOString(),
        };

        await this.produce(ComplianceTopics.KYC_REJECTED, userId, payload);
        await this.produceKycUpdated(userId, 'REJECTED', inquiryId);
    }

    /**
     * Emit kyc.review_required event
     */
    async kycReviewRequired(
        userId: string,
        inquiryId: string,
        riskFlags: any[],
    ): Promise<void> {
        const payload = {
            userId,
            inquiryId,
            state: 'PENDING',
            riskFlags,
            at: new Date().toISOString(),
        };

        await this.produce(ComplianceTopics.KYC_REVIEW_REQUIRED, userId, payload);
        await this.produceKycUpdated(userId, 'PENDING', inquiryId);
    }

    // ==========================================
    // LIMITS EVENTS
    // ==========================================

    /**
     * Emit limits.updated event
     */
    async limitsUpdated(
        userId: string,
        escrowLimit: number,
        ledgerLimit: number,
    ): Promise<void> {
        const payload = {
            userId,
            escrowLimit,
            ledgerLimit,
            updatedAt: new Date().toISOString(),
        };

        await this.produce(ComplianceTopics.LIMITS_UPDATED, userId, payload);
    }

    // ==========================================
    // FAILURE EVENTS
    // ==========================================

    /**
     * Emit compliance.failure event
     *
     * Used for monitoring, alerting, and reporting of compliance failures.
     * This event should be emitted when a failure occurs in the compliance service.
     */
    async complianceFailure(params: {
        userId?: string;
        entityType: 'kyc' | 'limits' | 'persona' | 'general';
        entityId?: string;
        failureType: 'validation' | 'external_service' | 'processing' | 'timeout';
        failureCode: string;
        failureReason: string;
        sourceOperation: string;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        retryable?: boolean;
        context?: Record<string, unknown>;
    }): Promise<void> {
        const payload = {
            userId: params.userId,
            entityType: params.entityType,
            entityId: params.entityId,
            failureType: params.failureType,
            failureCode: params.failureCode,
            failureReason: params.failureReason,
            sourceOperation: params.sourceOperation,
            severity: params.severity ?? 'medium',
            retryable: params.retryable ?? false,
            context: params.context,
            occurredAt: new Date().toISOString(),
        };

        const partitionKey = params.userId || params.entityId || 'compliance-failure';
        await this.produce(ComplianceTopics.FAILURE, partitionKey, payload);
    }

    // ==========================================
    // GENERIC KYC UPDATED (For Auth Service)
    // ==========================================

    /**
     * Produce kyc.updated event to the generic compliance.events topic
     * This is consumed by Auth Service
     */
    private async produceKycUpdated(
        userId: string,
        state: 'PENDING' | 'VERIFIED' | 'REJECTED',
        providerRef: string,
    ): Promise<void> {
        const payload = {
            userId,
            state,
            providerRef,
            at: new Date().toISOString(),
        };

        await this.produce(ComplianceTopics.EVENTS, userId, payload);
    }

    // ==========================================
    // CORE PRODUCE METHOD
    // ==========================================

    /**
     * Save event to outbox table (Transactional Outbox Pattern).
     * OutboxProcessorService will pick it up and publish to Kafka.
     */
    private async produce<T>(
        topic: ComplianceTopics,
        partitionKey: string,
        payload: T,
    ): Promise<void> {
        try {
            await this.outboxRepository.save(topic, partitionKey, payload);
            this.logger.debug(`Saved ${topic} to outbox for ${partitionKey}`);
        } catch (error: any) {
            this.logger.error(
                `Failed to save ${topic} to outbox for ${partitionKey}: ${error.message}`,
                error.stack,
            );
        }
    }
}
