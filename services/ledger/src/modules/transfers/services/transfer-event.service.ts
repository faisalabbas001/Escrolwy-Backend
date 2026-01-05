import { Injectable } from '@nestjs/common';
import { CreateTransferDto, TransferType } from '../dto/create-transfer.dto';
import { PrismaTransactionClient } from '../../../common/types';
import {
  TransferPostedEventProducer,
  BalanceUpdatedEventProducer,
  ExternalPayoutEventProducer,
  ExternalTransferEventProducer,
} from '../../../kafka/producers';

/**
 * Transfer Event Service
 *
 * Single Responsibility: Orchestrates event production for transfers
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - depends on event producer interfaces
 *
 * Coordinates:
 * - Transfer posted events (via TransferPostedEventProducer)
 * - Balance updated events (via BalanceUpdatedEventProducer)
 * - External payout events (via ExternalPayoutEventProducer)
 * - External transfer events (via ExternalTransferEventProducer) - for wallet service only
 *
 * Note: While we inject concrete classes (required by NestJS DI), they implement interfaces
 * which provides type safety and allows for easy substitution in tests or future implementations.
 */
@Injectable()
export class TransferEventService {
  constructor(
    private readonly transferPostedProducer: TransferPostedEventProducer,
    private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
    private readonly externalPayoutProducer: ExternalPayoutEventProducer,
    private readonly externalTransferProducer: ExternalTransferEventProducer,
  ) {}

  /**
   * Create outbox events for Kafka
   */
  async createEvents(
    createTransferDto: CreateTransferDto,
    transfer: any,
    journalId: string,
    senderId: string,
    senderAccountId: string,
    creditAccountId: string,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    // Always produce transfer posted event
    if(createTransferDto.type === TransferType.INTERNAL) {
    await this.transferPostedProducer.produce(
      {
        transfer,
        createTransferDto,
        journalId,
        senderId,
      },
      tx,
    );
  }

    // Produce external transfer event for wallet service (only for external transfers)
    if (createTransferDto.type === TransferType.EXTERNAL) {
      await this.externalTransferProducer.produce(
        {
          transfer,
          createTransferDto,
          userId: senderId,
        },
        tx,
      );
    }
  }
}

