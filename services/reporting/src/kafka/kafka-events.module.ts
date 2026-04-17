import { Global, Module } from '@nestjs/common';
import { ReportingEventProducer } from './reporting-event.producer';
import { ReportingConsumer } from './consumers';
import { OutboxRepository } from './repository';
import {
    LedgerEntryHandler,
    WalletDepositHandler,
    WalletWithdrawalHandler,
    EscrowEventHandler,
    KycVerificationHandler,
    AdminAuditHandler,
    InquiryResolvedHandler,
    KafkaFailureHandler,
    EventValidatorService,
} from './consumers';
import { AlertsModule } from '../alerts';

/**
 * Kafka Events Module
 *
 * Provides Kafka event producer and consumer for the Reporting Service.
 * Uses transactional outbox pattern via @escrowly/kafka-publisher.
 *
 * @Global decorator makes the producer available across all modules.
 */
@Global()
@Module({
    imports: [AlertsModule],
    providers: [
        // Repository
        OutboxRepository,

        // Producer
        ReportingEventProducer,

        // Consumer
        ReportingConsumer,

        // Event Handlers
        LedgerEntryHandler,
        WalletDepositHandler,
        WalletWithdrawalHandler,
        EscrowEventHandler,
        KycVerificationHandler,
        AdminAuditHandler,
        InquiryResolvedHandler,
        KafkaFailureHandler,

        // Validators
        EventValidatorService,
    ],
    exports: [
        ReportingEventProducer,
        ReportingConsumer,
        OutboxRepository,
    ],
})
export class KafkaEventsModule { }
