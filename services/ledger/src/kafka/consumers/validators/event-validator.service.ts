import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent, SchemaValidator } from '@escrowly/kafka-core';

/**
 * Event Validator Service
 *
 * Single Responsibility: Validates Kafka events
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class EventValidatorService {
  private readonly logger = new Logger(EventValidatorService.name);

  /**
   * Validate event schema
   * @param event Event to validate
   * @param topic Topic name for logging
   * @returns true if valid, false otherwise
   */
  validate(event: BaseEvent<unknown>, topic: string): boolean {
    if (!SchemaValidator.validateEvent(event)) {
      this.logger.warn('Invalid event schema', {
        topic,
        eventId: event.metadata?.eventId,
        payloadKeys: event?.payload ? Object.keys(event.payload as any) : [],
      });
      return false;
    }
    return true;
  }
}

