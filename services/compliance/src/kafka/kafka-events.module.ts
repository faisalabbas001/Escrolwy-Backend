import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma';
import { PrismaOutboxAdapter } from './prisma-outbox.adapter';
import { OutboxRepository } from '../kyc/outbox.repository';
import { ComplianceEventProducer } from './compliance-event.producer';
import {
    ComplianceConsumer,
    UserCreatedHandler,
    EventValidatorService,
} from './consumers';

/**
 * Kafka Events Module
 *
 * Configures Kafka integration for Compliance Service:
 * - PrismaOutboxAdapter: Implements OutboxAdapter interface
 * - OutboxRepository: Persists events to outbox table
 * - ComplianceEventProducer: Writes events to outbox
 * - ComplianceConsumer: Orchestrates event subscriptions
 * - Handlers: Process specific event types (SRP)
 *
 * Architecture matches Auth Service pattern for consistency.
 */
@Global()
@Module({
    imports: [PrismaModule, ConfigModule],
    providers: [
        // Outbox and producer
        PrismaOutboxAdapter,
        OutboxRepository,
        ComplianceEventProducer,
        // Consumer orchestrator
        ComplianceConsumer,
        // Event handlers
        UserCreatedHandler,
        // Validators
        EventValidatorService,
    ],
    exports: [
        ComplianceEventProducer,
        OutboxRepository,
        PrismaOutboxAdapter,
    ],
})
export class KafkaEventsModule { }
