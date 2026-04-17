import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent } from '@escrowly/kafka-core';

/**
 * Event Validator Service
 *
 * Validates incoming Kafka events.
 * Follows Single Responsibility Principle (SRP).
 */
@Injectable()
export class EventValidatorService {
    private readonly logger = new Logger(EventValidatorService.name);

    /**
     * Validate an event
     */
    validate<T>(event: BaseEvent<T>, eventType: string): boolean {
        if (!event) {
            this.logger.warn(`[${eventType}] Invalid event: null or undefined`);
            return false;
        }

        if (!event.metadata) {
            this.logger.warn(`[${eventType}] Invalid event: missing metadata`);
            return false;
        }

        if (!event.payload) {
            this.logger.warn(`[${eventType}] Invalid event: missing payload`);
            return false;
        }

        return true;
    }
}
