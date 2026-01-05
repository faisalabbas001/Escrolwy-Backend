import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent } from '@escrowly/kafka-core';
import { AggregationService } from '../../../aggregation';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators';

/**
 * Inquiry Resolved Handler
 *
 * Handles inquiry resolved events
 * Creates audit snapshots for inquiry resolutions
 */
@Injectable()
export class InquiryResolvedHandler implements IEventHandler<any> {
    private readonly logger = new Logger(InquiryResolvedHandler.name);

    constructor(
        private readonly aggregation: AggregationService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<any>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'INQUIRY_RESOLVED')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            const { inquiryId, userId, resolution } = payload as any;

            this.logger.debug(`Processing inquiry resolved: ${inquiryId}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
            });

            await this.aggregation.createAuditSnapshot({
                eventType: `inquiry_${resolution?.toLowerCase() || 'resolved'}`,
                referenceId: inquiryId,
                userId,
                metadata: payload,
            });

            this.logger.log(`Processed inquiry resolution: ${inquiryId}`, {
                eventId: metadata.eventId,
            });
        } catch (error: any) {
            this.logger.error(`Failed to process inquiry resolved: ${error.message}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
                stack: error.stack,
            });
            throw error;
        }
    }
}
