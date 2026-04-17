import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEvent,
  TransactionConfirmedPayload,
} from '@escrowly/kafka-core';
import { TransferRepository } from '../../../modules/transfers/repository';
import { IEventHandler } from './event-handler.interface';
import { EventValidatorService } from '../validators/event-validator.service';
import { TransferIdExtractorService } from '../services/transfer-id-extractor.service';

/**
 * Transaction Confirmed Handler
 *
 * Single Responsibility: Handles TRANSACTION_CONFIRMED events
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - implements IEventHandler
 */
@Injectable()
export class TransactionConfirmedHandler
  implements IEventHandler<TransactionConfirmedPayload>
{
  private readonly logger = new Logger(TransactionConfirmedHandler.name);

  constructor(
    private readonly transferRepository: TransferRepository,
    private readonly validator: EventValidatorService,
    private readonly transferIdExtractor: TransferIdExtractorService,
  ) {}

  async handle(event: BaseEvent<TransactionConfirmedPayload>): Promise<void> {
    // Validate event
    if (!this.validator.validate(event, 'TRANSACTION_CONFIRMED')) {
      return;
    }

    const { payload, metadata } = event;
    this.logger.debug('Processing TRANSACTION_CONFIRMED event', {
      eventId: metadata.eventId,
      transactionId: payload.transactionId,
      transactionHash: payload.transactionHash,
    });

    // Extract transfer ID
    const transferId = this.transferIdExtractor.extract(payload.transactionId);
    if (!transferId) {
      this.logger.warn('No transferId found in TRANSACTION_CONFIRMED payload', {
        transactionId: payload.transactionId,
        eventId: metadata.eventId,
      });
      return;
    }

    // Update transfer status
    const updated = await this.transferRepository.updateStatus(
      transferId,
      'completed',
      null,
    );

    if (updated) {
      this.logger.log(
        `Transfer ${transferId} confirmed on blockchain (tx: ${payload.transactionHash})`,
        {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      );
    } else {
      this.logger.warn(`Transfer ${transferId} not found or not updatable`, {
        transactionId: payload.transactionId,
        eventId: metadata.eventId,
      });
    }
  }
}

