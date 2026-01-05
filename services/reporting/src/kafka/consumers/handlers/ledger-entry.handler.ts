import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, LedgerEventPayloads } from '@escrowly/kafka-core';
import { AggregationService } from '../../../aggregation';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators';

/**
 * Ledger Entry Handler
 *
 * Handles ledger.events for entry creation
 * Updates daily metrics and creates audit snapshots
 */
@Injectable()
export class LedgerEntryHandler implements IEventHandler<LedgerEventPayloads> {
    private readonly logger = new Logger(LedgerEntryHandler.name);

    constructor(
        private readonly aggregation: AggregationService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<LedgerEventPayloads>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'LEDGER_ENTRY')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            // Handle different ledger event types
            if ('action' in payload) {
                const { action, userId, amount, currency, entryId } = payload as any;

                this.logger.debug(`Processing ledger entry: ${action}`, {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                });

                // Create audit snapshot
                await this.aggregation.createAuditSnapshot({
                    eventType: `ledger_${action}`,
                    referenceId: entryId || metadata.eventId,
                    userId,
                    amount: amount ? Number(amount) : undefined,
                    metadata: payload,
                });

                // Update metrics based on action type
                if (action === 'DEPOSIT' || action === 'deposit') {
                    await this.aggregation.recordDeposit(Number(amount), currency);
                } else if (action === 'WITHDRAWAL' || action === 'withdrawal') {
                    await this.aggregation.recordWithdrawal(Number(amount), currency);
                } else if (action === 'TRANSFER' || action === 'transfer') {
                    await this.aggregation.recordInternalTransfer(Number(amount), currency);
                }

                this.logger.log(`Processed ledger entry: ${action}`, {
                    eventId: metadata.eventId,
                });
            }
        } catch (error: any) {
            this.logger.error(`Failed to process ledger entry: ${error.message}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
                stack: error.stack,
            });
            throw error;
        }
    }
}
