import { Injectable, Logger } from '@nestjs/common';
import {
    BaseEvent,
    WalletsCreatedPayload,
} from '@escrowly/kafka-core';
import { PrismaService } from '../../../prisma';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators/event-validator.service';

/**
 * Wallets Created Handler
 *
 * Single Responsibility: Handles user.wallets_created events
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - implements IEventHandler
 *
 * Updates wallet_ready flag on user profile when wallets are created.
 */
@Injectable()
export class WalletsCreatedHandler
    implements IEventHandler<WalletsCreatedPayload> {
    private readonly logger = new Logger(WalletsCreatedHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly validator: EventValidatorService,
    ) { }

    async handle(event: BaseEvent<WalletsCreatedPayload>): Promise<void> {
        // Validate event
        if (!this.validator.validate(event, 'WALLETS_CREATED')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            const { userId, wallets } = payload;
            this.logger.debug(
                `Received wallets_created for user ${userId}: ${wallets.length} wallets`,
                {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                },
            );

            // Update wallet_ready flag on user profile
            await this.prisma.userProfile.update({
                where: { userId },
                data: { walletReady: true },
            });

            this.logger.log(`Wallet ready updated for user ${userId}`, {
                eventId: metadata.eventId,
                correlationId: metadata.correlationId,
            });
        } catch (error: any) {
            this.logger.error(
                `Failed to process wallets_created: ${error.message}`,
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
