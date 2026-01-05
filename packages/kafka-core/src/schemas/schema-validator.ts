import { Logger } from '@nestjs/common';
import { BaseEvent, EventMetadata } from './event.schema';

/**
 * Schema Validator
 *
 * Validates event structure before producing/after consuming.
 * Ensures data integrity across services.
 */
export class SchemaValidator {
  private static readonly logger = new Logger('SchemaValidator');

  /**
   * Validate event has required metadata
   */
  static validateMetadata(metadata: EventMetadata): boolean {
    const required = ['eventId', 'timestamp', 'eventType', 'source', 'version'];

    for (const field of required) {
      if (!(metadata as any)[field]) {
        this.logger.error(`Missing required metadata field: ${field}`);
        return false;
      }
    }

    // Validate UUID format for eventId
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(metadata.eventId)) {
      this.logger.error(`Invalid eventId format: ${metadata.eventId}`);
      return false;
    }

    // Validate ISO timestamp
    const date = new Date(metadata.timestamp);
    if (isNaN(date.getTime())) {
      this.logger.error(`Invalid timestamp format: ${metadata.timestamp}`);
      return false;
    }

    return true;
  }

  /**
   * Validate full event structure
   */
  static validateEvent<T>(event: BaseEvent<T>): boolean {
    if (!event.metadata) {
      this.logger.error('Event missing metadata');
      return false;
    }

    if (!event.payload) {
      this.logger.error('Event missing payload');
      return false;
    }

    return this.validateMetadata(event.metadata);
  }

  /**
   * Parse and validate JSON event from Kafka message
   */
  static parseEvent<T>(message: string): BaseEvent<T> | null {
    try {
      const event = JSON.parse(message) as BaseEvent<T>;

      if (!this.validateEvent(event)) {
        return null;
      }

      return event;
    } catch (error: any) {
      this.logger.error(`Failed to parse event: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate payload has required fields
   */
  static validatePayload(
    payload: Record<string, unknown>,
    requiredFields: string[],
  ): boolean {
    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null) {
        this.logger.error(`Missing required payload field: ${field}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Required fields by event type
   */
  static readonly REQUIRED_FIELDS: Record<string, string[]> = {
    'escrow.created': ['escrow', 'initiatedBy'],
    'escrow.accepted': ['escrowId', 'acceptedBy', 'buyerId', 'sellerId'],
    'escrow.payment.completed': [
      'escrowId',
      'buyerId',
      'sellerId',
      'amount',
      'asset',
      'ledgerAction',
    ],
    'escrow.completed': [
      'escrowId',
      'buyerId',
      'sellerId',
      'amount',
      'ledgerAction',
    ],
    'escrow.disputed': [
      'escrowId',
      'disputedBy',
      'buyerId',
      'sellerId',
      'reason',
      'ledgerAction',
    ],
    'escrow.resolved': [
      'escrowId',
      'buyerId',
      'sellerId',
      'resolution',
      'ledgerAction',
    ],
    'auth.user.created': ['userId', 'email', 'role'],
    'auth.session.created': ['sessionId', 'userId'],
    'ledger.balance.reserved': ['walletId', 'userId', 'amount', 'escrowId'],
    'ledger.balance.released': ['walletId', 'userId', 'amount', 'releasedTo'],
  };

  /**
   * Validate event payload based on event type
   */
  static validateByType(eventType: string, payload: Record<string, unknown>): boolean {
    const requiredFields = this.REQUIRED_FIELDS[eventType];
    if (!requiredFields) {
      this.logger.warn(`No validation rules for event type: ${eventType}`);
      return true;
    }
    return this.validatePayload(payload, requiredFields);
  }
}

