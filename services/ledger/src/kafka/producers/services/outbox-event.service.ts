import { Injectable } from '@nestjs/common';
import { OutboxRepository } from '../../../modules/transfers/repository';
import { PrismaTransactionClient } from '../types';

/**
 * Outbox Event Service
 *
 * Single Responsibility: Handles outbox event creation
 * Follows Single Responsibility Principle (SRP)
 * Follows DRY (Don't Repeat Yourself) principle
 *
 * Encapsulates the common pattern of creating outbox events,
 * allowing producers to focus solely on building payloads.
 */
@Injectable()
export class OutboxEventService {
  constructor(private readonly outboxRepository: OutboxRepository) {}

  /**
   * Create an outbox event
   * @param eventType Kafka topic/event type
   * @param eventKey Partition key for the event
   * @param payload Event payload
   * @param tx Optional transaction client
   */
  async createEvent(
    eventType: string,
    eventKey: string,
    payload: unknown,
    tx?: PrismaTransactionClient,
  ): Promise<void> {
    await this.outboxRepository.create(
      {
        eventType,
        eventKey,
        payload: payload as any,
        status: 'pending',
      },
      tx,
    );
  }
}

