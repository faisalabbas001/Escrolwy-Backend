import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent } from '@escrowly/kafka-core';
import { AggregationService } from '../../../aggregation';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators';

/**
 * Admin Audit Handler
 *
 * Handles admin audit logged events
 * Creates audit snapshots for admin actions
 */
@Injectable()
export class AdminAuditHandler implements IEventHandler {
    private readonly logger = new Logger(AdminAuditHandler.name);

    constructor(
        private readonly aggregation: AggregationService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<any>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'ADMIN_AUDIT')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            const { action, adminId, targetId, details } = payload;

            this.logger.debug(`Processing admin audit: ${action}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
            });

            await this.aggregation.createAuditSnapshot({
                eventType: `admin_${action?.toLowerCase() || 'action'}`,
                referenceId: targetId || adminId,
                userId: adminId,
                metadata: payload,
            });

            this.logger.log(`Processed admin audit: ${action}`, {
                eventId: metadata.eventId,
            });
        } catch (error: any) {
            this.logger.error(`Failed to process admin audit: ${error.message}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
                stack: error.stack,
            });
            throw error;
        }
    }
}
