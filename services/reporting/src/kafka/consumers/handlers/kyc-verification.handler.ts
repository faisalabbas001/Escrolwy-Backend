import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, ComplianceEventPayloads } from '@escrowly/kafka-core';
import { AggregationService } from '../../../aggregation';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators';

/**
 * KYC Verification Handler
 *
 * Handles KYC verification completed events
 * Creates audit snapshots for KYC status changes
 */
@Injectable()
export class KycVerificationHandler implements IEventHandler<ComplianceEventPayloads> {
    private readonly logger = new Logger(KycVerificationHandler.name);

    constructor(
        private readonly aggregation: AggregationService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<ComplianceEventPayloads>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'KYC_VERIFICATION')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            const { userId, status, inquiryId } = payload as any;

            this.logger.debug(`Processing KYC verification: ${inquiryId}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
            });

            await this.aggregation.createAuditSnapshot({
                eventType: `kyc_${status?.toLowerCase() || 'unknown'}`,
                referenceId: inquiryId,
                userId,
                metadata: payload,
            });

            this.logger.log(`Processed KYC verification: ${inquiryId}`, {
                eventId: metadata.eventId,
            });
        } catch (error: any) {
            this.logger.error(`Failed to process KYC verification: ${error.message}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
                stack: error.stack,
            });
            throw error;
        }
    }
}
