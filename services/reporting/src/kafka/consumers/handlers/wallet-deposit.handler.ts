import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, WalletEventPayloads } from '@escrowly/kafka-core';
import { AggregationService } from '../../../aggregation';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators';

/**
 * Wallet Deposit Handler
 *
 * Handles wallet deposit detected events
 * Creates audit snapshots for deposits
 */
@Injectable()
export class WalletDepositHandler implements IEventHandler<WalletEventPayloads> {
    private readonly logger = new Logger(WalletDepositHandler.name);

    constructor(
        private readonly aggregation: AggregationService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<WalletEventPayloads>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'WALLET_DEPOSIT')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            // Check if this is a deposit event
            if ('amount' in payload && 'txHash' in payload) {
                const { amount, currency, userId, txHash } = payload as any;

                this.logger.debug(`Processing wallet deposit: ${txHash}`, {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                });

                // Update metrics
                await this.aggregation.recordDeposit(Number(amount), currency);

                // Update system metric (for verification purposes)
                await this.aggregation.updateSystemMetric({
                    serviceName: 'wallet-service',
                    metricType: 'deposit_processed',
                    metricValue: 1, // Increment would be better but upsert just sets it. Aggregation service logic is upsert set. 
                    chain: 'ETH' // Dummy chain
                });

                await this.aggregation.createAuditSnapshot({
                    eventType: 'deposit',
                    referenceId: txHash,
                    userId,
                    amount: Number(amount),
                    metadata: payload,
                });

                this.logger.debug(`Processed wallet deposit: ${txHash}`, {
                    eventId: metadata.eventId,
                });
            }
        } catch (error: any) {
            this.logger.error(`Failed to process wallet deposit: ${error.message}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
                stack: error.stack,
            });
            throw error;
        }
    }
}
