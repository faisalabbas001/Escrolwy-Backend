import { Injectable, BadRequestException } from '@nestjs/common';
import { LedgerTopics, ExternalTransferCreatedPayload } from '@escrowly/kafka-core';
import { IEventProducer } from './event-producer.interface';
import { OutboxEventService } from './services/outbox-event.service';
import { PrismaTransactionClient } from './types';
import { CreateTransferDto } from '../../modules/transfers/dto/create-transfer.dto';

/**
 * External Transfer Event Producer
 *
 * Single Responsibility: Builds EXTERNAL_TRANSFER_CREATED event payload for wallet service
 * Follows Single Responsibility Principle (SRP) - focuses on payload construction
 * Follows Dependency Inversion Principle (DIP) - implements IEventProducer
 * Follows DRY principle - uses OutboxEventService for outbox creation
 *
 * This event is specifically for wallet service consumption only.
 * It is separate from EXTERNAL_PAYOUT_CREATED which is for blockchain worker service.
 */
@Injectable()
export class ExternalTransferEventProducer
  implements IEventProducer<{
    transfer: any;
    createTransferDto: CreateTransferDto;
    userId: string;
  }>
{
  constructor(private readonly outboxEventService: OutboxEventService) {}

  async produce(
    data: {
      transfer: any;
      createTransferDto: CreateTransferDto;
      userId: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    // Validate required fields for external transfers
    if (!data.createTransferDto.destinationAddress) {
      throw new BadRequestException(
        'destinationAddress is required for external transfers',
      );
    }

    // Use destinationChain if provided, otherwise fallback to chain
    const destinationChain =
      data.createTransferDto.destinationChain || data.createTransferDto.chain;

    const payload: ExternalTransferCreatedPayload = {
      transferId: data.transfer.id,
      userId: data.userId,
      asset: data.createTransferDto.asset,
      amount: data.createTransferDto.amount,
      chain: data.createTransferDto.chain,
      destinationAddress: data.createTransferDto.destinationAddress,
      destinationChain: destinationChain,
      idempotencyKey: data.transfer.idempotencyKey || data.transfer.id,
      createdAt: new Date().toISOString(),
    };

    await this.outboxEventService.createEvent(
      LedgerTopics.EXTERNAL_TRANSFER_CREATED,
      `external-transfer-${data.transfer.id}`,
      payload,
      tx,
    );
  }
}

