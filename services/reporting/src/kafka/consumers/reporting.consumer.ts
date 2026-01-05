import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
    KafkaService,
    WalletTopics,
    ComplianceTopics,
    NotificationTopics,
    AdminTopics,
    LedgerTopics,
    EscrowTopics,
    InquiryTopics,
    BaseEvent,
} from '@escrowly/kafka-core';
import {
    LedgerEntryHandler,
    WalletDepositHandler,
    WalletWithdrawalHandler,
    EscrowEventHandler,
    KycVerificationHandler,
    AdminAuditHandler,
    InquiryResolvedHandler,
    KafkaFailureHandler,
} from './handlers';

/**
 * Reporting Consumer
 *
 * Single Responsibility: Orchestrates Kafka event subscriptions
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - depends on handler interfaces
 *
 * Coordinates:
 * - Event subscription (via KafkaService)
 * - Event routing (via handlers)
 *
 * Listens to external events and routes to appropriate handlers:
 * - wallet.events → WalletDepositHandler, WalletWithdrawalHandler
 * - compliance.events → KycVerificationHandler
 *
 * Note: For services without aggregated event topics (Ledger, Escrow, Admin, Inquiry),
 * we subscribe to individual topic patterns or use a wildcard consumer approach.
 */
@Injectable()
export class ReportingConsumer implements OnModuleInit {
    private readonly logger = new Logger(ReportingConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly ledgerEntryHandler: LedgerEntryHandler,
        private readonly walletDepositHandler: WalletDepositHandler,
        private readonly walletWithdrawalHandler: WalletWithdrawalHandler,
        private readonly escrowEventHandler: EscrowEventHandler,
        private readonly kycVerificationHandler: KycVerificationHandler,
        private readonly adminAuditHandler: AdminAuditHandler,
        private readonly inquiryResolvedHandler: InquiryResolvedHandler,
        private readonly kafkaFailureHandler: KafkaFailureHandler,
    ) { }

    async onModuleInit(): Promise<void> {
        this.logger.log(`[DEBUG] Subscribing to Wallet Topic: ${WalletTopics.EVENTS}`);
        this.logger.log(`[DEBUG] Subscribing to Compliance Topic: ${ComplianceTopics.EVENTS}`);

        // Subscribe to wallet.events (handles both deposits and withdrawals)
        this.kafka.subscribe(
            WalletTopics.EVENTS,
            async (event: BaseEvent<any>) => {
                this.logger.debug(`[DEBUG] Received Wallet Event: ${JSON.stringify(event.metadata)}`);
                // Route to appropriate handler based on event type
                const eventType = (event.metadata?.eventType || '').toLowerCase();
                if (eventType.includes('deposit')) {
                    await this.walletDepositHandler.handle(event as any);
                } else if (eventType.includes('withdrawal')) {
                    await this.walletWithdrawalHandler.handle(event as any);
                }
            },
        );

        // Subscribe to compliance.events
        this.kafka.subscribe(
            ComplianceTopics.EVENTS,
            this.kycVerificationHandler.handle.bind(this.kycVerificationHandler),
        );

        // Subscribe to failures
        this.kafka.subscribe(
            ComplianceTopics.FAILURE,
            this.kafkaFailureHandler.handle.bind(this.kafkaFailureHandler),
        );

        this.kafka.subscribe(
            NotificationTopics.EMAIL_FAILED,
            this.kafkaFailureHandler.handle.bind(this.kafkaFailureHandler),
        );

        this.kafka.subscribe(
            NotificationTopics.PUSH_FAILED,
            this.kafkaFailureHandler.handle.bind(this.kafkaFailureHandler),
        );

        // Subscribe to Admin events
        this.kafka.subscribe(
            AdminTopics.AUDIT_LOG,
            this.adminAuditHandler.handle.bind(this.adminAuditHandler),
        );
        this.kafka.subscribe(
            AdminTopics.ADMIN_ACTION,
            this.adminAuditHandler.handle.bind(this.adminAuditHandler),
        );

        // Subscribe to Ledger events (for internal audit if needed, or update metrics?)
        // Assuming Ledger events might trigger other metrics, simplified for now:
        // this.kafka.subscribe(LedgerTopics.TRANSACTION_CONFIRMED, ...); 
        // For now, let's just ensure Admin works as requested.

        // Start consuming
        await this.kafka.startConsuming();

        this.logger.log(
            `Reporting consumer subscribed to all topics including Admin, Wallet, Compliance.`,
        );
    }
}
