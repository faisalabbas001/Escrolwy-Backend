import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, EscrowEventPayloads } from '@escrowly/kafka-core';
import { AggregationService } from '../../../aggregation';
import { AlertsService } from '../../../alerts';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators';

/**
 * Escrow Event Handler
 *
 * Handles all escrow events (created, completed, disputed, etc.)
 * Updates escrow metrics and triggers alerts for stuck escrows
 */
@Injectable()
export class EscrowEventHandler implements IEventHandler<EscrowEventPayloads> {
    private readonly logger = new Logger(EscrowEventHandler.name);

    constructor(
        private readonly aggregation: AggregationService,
        private readonly alerts: AlertsService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<EscrowEventPayloads>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'ESCROW_EVENT')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            const { escrowId, userId, amount, status } = payload as any;
            const eventType = metadata.eventType || 'unknown';

            this.logger.debug(`Processing escrow event: ${eventType}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
            });

            await this.aggregation.createAuditSnapshot({
                eventType: `escrow_${status?.toLowerCase() || 'unknown'}`,
                referenceId: escrowId,
                userId,
                amount: amount ? Number(amount) : undefined,
                metadata: payload,
            });

            // Update escrow metrics based on event type
            if (eventType.includes('created')) {
                await this.aggregation.recordEscrowCreated();
            } else if (eventType.includes('completed') || eventType.includes('released')) {
                await this.aggregation.recordEscrowCompleted();
            } else if (eventType.includes('disputed')) {
                await this.aggregation.recordEscrowDisputed();
            } else if (eventType.includes('refunded')) {
                await this.aggregation.recordEscrowRefunded();
            }

            // Check for stuck escrow alert
            const stateDuration = (payload as any).stateDuration;
            if (stateDuration && stateDuration > 48 * 60 * 60 * 1000) {
                await this.alerts.createAlert({
                    alertType: 'ESCROW_STUCK',
                    source: 'escrow-service',
                    severity: 'CRITICAL',
                    description: `Escrow ${escrowId} stuck for more than 48 hours`,
                    metadata: payload,
                });
            }

            this.logger.log(`Processed escrow event: ${escrowId}`, {
                eventId: metadata.eventId,
            });
        } catch (error: any) {
            this.logger.error(`Failed to process escrow event: ${error.message}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
                stack: error.stack,
            });
            throw error;
        }
    }
}
