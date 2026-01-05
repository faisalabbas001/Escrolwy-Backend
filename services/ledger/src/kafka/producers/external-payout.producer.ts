import { Injectable } from '@nestjs/common';
import { LedgerTopics, ExternalPayoutCreatedPayload } from '@escrowly/kafka-core';
import { IEventProducer } from './event-producer.interface';
import { OutboxEventService } from './services/outbox-event.service';
import { PrismaTransactionClient } from './types';

/**
 * External Payout Event Producer
 *
 * Single Responsibility: Builds EXTERNAL_PAYOUT_CREATED event payload
 * Follows Single Responsibility Principle (SRP) - focuses on payload construction
 * Follows Dependency Inversion Principle (DIP) - implements IEventProducer
 * Follows DRY principle - uses OutboxEventService for outbox creation
 */
@Injectable()
export class ExternalPayoutEventProducer
  implements IEventProducer<{
    transfer: any;
    createTransferDto: {
      asset: string;
      amount: number;
      chain: string;
      destinationAddress: string;
      destinationChain: string;
    };
    senderId: string;
  }>
{
  constructor(private readonly outboxEventService: OutboxEventService) {}

  async produce(
    data: {
      transfer: any;
      createTransferDto: {
        asset: string;
        amount: number;
        chain: string;
        destinationAddress: string;
        destinationChain: string;
      };
      senderId: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const payload: ExternalPayoutCreatedPayload = {
      transferId: data.transfer.id,
      asset: data.createTransferDto.asset,
      amount: data.createTransferDto.amount,
      chain: data.createTransferDto.chain,
      senderId: data.senderId,
      destinationAddress: data.createTransferDto.destinationAddress,
      destinationChain: data.createTransferDto.destinationChain,
      createdAt: new Date().toISOString(),
    };

    await this.outboxEventService.createEvent(
      LedgerTopics.EXTERNAL_PAYOUT_CREATED,
      `payout-${data.transfer.id}`,
      payload,
      tx,
    );
  }
}

