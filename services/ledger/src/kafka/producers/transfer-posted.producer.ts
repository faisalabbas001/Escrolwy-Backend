import { Injectable } from '@nestjs/common';
import { LedgerTopics, TransferPostedPayload } from '@escrowly/kafka-core';
import { IEventProducer } from './event-producer.interface';
import { OutboxEventService } from './services/outbox-event.service';
import { PrismaTransactionClient } from './types';

/**
 * Transfer Posted Event Producer
 *
 * Single Responsibility: Builds TRANSFER_POSTED event payload
 * Follows Single Responsibility Principle (SRP) - focuses on payload construction
 * Follows Dependency Inversion Principle (DIP) - implements IEventProducer
 * Follows DRY principle - uses OutboxEventService for outbox creation
 */
@Injectable()
export class TransferPostedEventProducer
  implements IEventProducer<{
    transfer: any;
    createTransferDto: {
      type: string;
      asset: string;
      amount: number;
      chain: string;
      destinationUserId?: string | null;
      destinationAddress?: string | null;
      destinationChain?: string;
    };
    journalId: string;
    senderId: string;
  }>
{
  constructor(private readonly outboxEventService: OutboxEventService) {}

  async produce(
    data: {
      transfer: any;
      createTransferDto: {
        type: string;
        asset: string;
        amount: number;
        chain: string;
        destinationUserId?: string | null;
        destinationAddress?: string | null;
        destinationChain?: string;
      };
      journalId: string;
      senderId: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    const payload: TransferPostedPayload = {
      transferId: data.transfer.id,
      type: data.createTransferDto.type as 'internal' | 'external' | 'escrow_released',
      asset: data.createTransferDto.asset,
      amount: data.createTransferDto.amount,
      chain: data.createTransferDto.chain,
      senderId: data.senderId,
      destinationUserId: data.createTransferDto.destinationUserId || undefined,
      destinationAddress: data.createTransferDto.destinationAddress || undefined,
      destinationChain:
        data.createTransferDto.destinationChain || data.createTransferDto.chain,
      journalId: data.journalId,
      postedAt: new Date().toISOString(),
    };

    await this.outboxEventService.createEvent(
      LedgerTopics.TRANSFER_POSTED,
      data.transfer.idempotencyKey || data.transfer.id,
      payload,
      tx,
    );
  }
}

