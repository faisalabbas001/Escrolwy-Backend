import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, WalletEventPayloads } from '@escrowly/kafka-core';
import { AggregationService } from '../../../aggregation';
import { AlertsService } from '../../../alerts';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators';

/**
 * Wallet Withdrawal Handler
 *
 * Handles wallet withdrawal completed events
 * Creates audit snapshots and triggers alerts for failures
 */
@Injectable()
export class WalletWithdrawalHandler implements IEventHandler<WalletEventPayloads> {
    private readonly logger = new Logger(WalletWithdrawalHandler.name);

    constructor(
        private readonly aggregation: AggregationService,
        private readonly alerts: AlertsService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<WalletEventPayloads>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'WALLET_WITHDRAWAL')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            // Check if this is a withdrawal event
            if ('amount' in payload && 'txHash' in payload) {
                const { amount, currency, userId, txHash, status } = payload as any;

                this.logger.debug(`Processing wallet withdrawal: ${txHash}`, {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                });

                await this.aggregation.createAuditSnapshot({
                    eventType: 'withdrawal',
                    referenceId: txHash,
                    userId,
                    amount: Number(amount),
                    metadata: payload,
                });

                if (status === 'COMPLETED') {
                    await this.aggregation.recordWithdrawal(Number(amount), currency);
                }

                // Check for failed withdrawal alert
                if (status === 'failed') {
                    await this.alerts.createAlert({
                        alertType: 'FAILED_WITHDRAWALS',
                        source: 'wallet-service',
                        severity: 'MEDIUM',
                        description: `Withdrawal failed for user ${userId}: ${txHash}`,
                        metadata: payload,
                    });
                }

                this.logger.log(`Processed wallet withdrawal: ${txHash}`, {
                    eventId: metadata.eventId,
                });
            }
        } catch (error: any) {
            this.logger.error(`Failed to process wallet withdrawal: ${error.message}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
                stack: error.stack,
            });
            throw error;
        }
    }
}
