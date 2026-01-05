import { Injectable, Logger } from '@nestjs/common';
import {
    BaseEvent,
    KycUpdatedPayload,
} from '@escrowly/kafka-core';
import { PrismaService } from '../../../prisma';
import { AuthEventProducer } from '../../auth-event.producer';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators/event-validator.service';

/**
 * KYC Updated Handler
 *
 * Single Responsibility: Handles kyc.updated events
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - implements IEventHandler
 *
 * Updates KYC status in database and emits kyc_state_changed event.
 */
@Injectable()
export class KycUpdatedHandler
    implements IEventHandler<KycUpdatedPayload> {
    private readonly logger = new Logger(KycUpdatedHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventProducer: AuthEventProducer,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<KycUpdatedPayload>): Promise<void> {
        this.logger.log(`[DEBUG] KycUpdatedHandler received event: ${JSON.stringify(event.metadata)}`);
        // Validate event
        if (!this.validator.validate(event, 'KYC_UPDATED')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            const { userId, state, providerRef } = payload;
            this.logger.debug(
                `Received kyc.updated for user ${userId}: ${state}`,
                {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                },
            );

            // Get current KYC status for comparison
            const currentKyc = await this.prisma.kycStatus.findUnique({
                where: { userId },
            });

            const oldState = currentKyc?.status || 'not_started';
            let newState = state.toLowerCase();

            // Map 'verified' payload state to 'approved' DB state if needed
            if (newState === 'verified') {
                newState = 'approved';
            }

            // Update KYC status
            await this.prisma.kycStatus.upsert({
                where: { userId },
                create: {
                    userId,
                    status: newState,
                    referenceId: providerRef,
                },
                update: {
                    status: newState,
                    referenceId: providerRef,
                },
            });

            // Also update the user profile's kycStatus field
            await this.prisma.userProfile.update({
                where: { userId },
                data: { kycStatus: newState },
            });

            // Emit user.kyc_state_changed event
            await this.eventProducer.userKycStateChanged(
                userId,
                oldState,
                newState,
                'compliance-service',
            );

            this.logger.log(
                `KYC status updated for user ${userId}: ${oldState} → ${newState}`,
                {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                },
            );
        } catch (error: any) {
            this.logger.error(
                `Failed to process kyc.updated: ${error.message}`,
                {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                    stack: error.stack,
                },
            );
            throw error; // Re-throw for retry handling
        }
    }
}
