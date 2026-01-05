import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEvent,
  TransactionFailedPayload,
} from '@escrowly/kafka-core';
import { TransferRepository } from '../../../modules/transfers/repository';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators/event-validator.service';
import { TransferIdExtractorService } from '../services/transfer-id-extractor.service';

/**
 * Transaction Failed Handler
 *
 * Single Responsibility: Handles TRANSACTION_FAILED events
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - implements IEventHandler
 */
@Injectable()
export class TransactionFailedHandler
  implements IEventHandler<TransactionFailedPayload>
{
  private readonly logger = new Logger(TransactionFailedHandler.name);

  constructor(
    private readonly transferRepository: TransferRepository,
    private readonly validator: EventValidatorService,
    private readonly transferIdExtractor: TransferIdExtractorService,
  ) {}

  async handle(event: BaseEvent<TransactionFailedPayload>): Promise<void> {
    // Validate event
    if (!this.validator.validate(event, 'TRANSACTION_FAILED')) {
      return;
    }

    const { payload, metadata } = event;
    this.logger.debug('Processing TRANSACTION_FAILED event', {
      eventId: metadata.eventId,
      transactionId: payload.transactionId,
      reason: payload.reason,
    });

    // Extract transfer ID
    const transferId = this.transferIdExtractor.extract(payload.transactionId);
    if (!transferId) {
      this.logger.warn('No transferId found in TRANSACTION_FAILED payload', {
        transactionId: payload.transactionId,
        eventId: metadata.eventId,
      });
      return;
    }

    // Update transfer status to failed
    const updated = await this.transferRepository.updateStatus(
      transferId,
      'failed',
      payload.reason || 'Blockchain transaction failed',
    );

    if (updated) {
      this.logger.log(`Transfer ${transferId} marked as failed`, {
        eventId: metadata.eventId,
        reason: payload.reason,
        correlationId: metadata.correlationId,
      });
    } else {
      this.logger.warn(`Transfer ${transferId} not found or not updatable`, {
        transactionId: payload.transactionId,
        eventId: metadata.eventId,
      });
    }
  }
}

