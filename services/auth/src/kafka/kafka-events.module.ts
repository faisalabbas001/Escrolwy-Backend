import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma';
import { PrismaOutboxAdapter } from './prisma-outbox.adapter';
import { OutboxRepository } from '../auth/repository';
import { AuthEventProducer } from './auth-event.producer';
import {
  AuthConsumer,
  WalletsCreatedHandler,
  KycUpdatedHandler,
  EventValidatorService,
} from './consumers';

/**
 * Kafka Events Module
 *
 * Configures Kafka integration for Auth Service:
 * - KafkaModule: Core Kafka connectivity (configured in app.module.ts)
 * - OutboxRepository: Persists events to outbox table (from auth/repository)
 * - AuthEventProducer: Writes events to outbox
 * - AuthConsumer: Orchestrates event subscriptions
 * - Handlers: Process specific event types (SRP)
 *
 * Architecture matches Ledger Service pattern for consistency.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
  ],
  providers: [
    // Outbox and producer
    PrismaOutboxAdapter,
    OutboxRepository,
    AuthEventProducer,
    // Consumer orchestrator
    AuthConsumer,
    // Event handlers
    WalletsCreatedHandler,
    KycUpdatedHandler,
    // Validators
    EventValidatorService,
  ],
  exports: [
    AuthEventProducer,
    OutboxRepository,
    PrismaOutboxAdapter,
  ],
})
export class KafkaEventsModule { }
