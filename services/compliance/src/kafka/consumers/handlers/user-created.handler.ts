import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, UserCreatedPayload } from '@escrowly/kafka-core';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators/event-validator.service';

/**
 * User Created Handler
 *
 * Handles user.created events from Auth Service.
 * Prepares user for KYC flow.
 */
@Injectable()
export class UserCreatedHandler implements IEventHandler<BaseEvent<UserCreatedPayload>> {
    private readonly logger = new Logger(UserCreatedHandler.name);

    constructor(private readonly validator: EventValidatorService) { }

    async handle(event: BaseEvent<UserCreatedPayload>): Promise<void> {
        this.logger.log(`[DEBUG] UserCreatedHandler received event: ${JSON.stringify(event.metadata)}`);

        // Validate event
        if (!this.validator.validate(event, 'USER_CREATED')) {
            return;
        }

        const { payload, metadata } = event;

        try {
            const { userId, email, role } = payload;
            this.logger.debug(
                `Received user.created for user ${userId}: ${email}`,
                {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                },
            );

            // Log user creation - Compliance service doesn't need to take action
            // KYC flow is initiated by user calling POST /kyc/start
            this.logger.log(
                `User ${userId} (${email}) registered with role ${role}. KYC can be initiated when ready.`,
                {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                },
            );
        } catch (error: any) {
            this.logger.error(
                `Failed to process user.created: ${error.message}`,
                {
                    eventId: metadata.eventId,
                    correlationId: metadata.correlationId,
                    stack: error.stack,
                },
            );
            throw error;
        }
    }
}
