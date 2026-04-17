import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
    KafkaService,
    WalletTopics,
    ComplianceTopics,
} from '@escrowly/kafka-core';
import {
    WalletsCreatedHandler,
    KycUpdatedHandler,
} from './handlers';

/**
 * Auth Consumer
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
 * - wallet.events → WalletsCreatedHandler
 * - compliance.events → KycUpdatedHandler
 */
@Injectable()
export class AuthConsumer implements OnModuleInit {
    private readonly logger = new Logger(AuthConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly walletsCreatedHandler: WalletsCreatedHandler,
        private readonly kycUpdatedHandler: KycUpdatedHandler,
    ) { }

    async onModuleInit(): Promise<void> {
        this.logger.log(`[DEBUG] Subscribing to Wallet Topic: ${WalletTopics.EVENTS}`);
        this.logger.log(`[DEBUG] Subscribing to Compliance Topic: ${ComplianceTopics.EVENTS}`);

        // Subscribe to wallet.events
        this.kafka.subscribe(
            WalletTopics.EVENTS,
            this.walletsCreatedHandler.handle.bind(this.walletsCreatedHandler),
        );

        // Subscribe to compliance.events
        this.kafka.subscribe(
            ComplianceTopics.EVENTS,
            this.kycUpdatedHandler.handle.bind(this.kycUpdatedHandler),
        );

        // Start consuming
        await this.kafka.startConsuming();

        this.logger.log(
            `Auth consumer subscribed to topics: ${WalletTopics.EVENTS}, ${ComplianceTopics.EVENTS}`,
        );
    }
}
