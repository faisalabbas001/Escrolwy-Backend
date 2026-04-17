import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService, AuthTopics } from '@escrowly/kafka-core';
import { UserCreatedHandler } from './handlers';

/**
 * Compliance Consumer
 *
 * Orchestrates Kafka event subscriptions for Compliance Service.
 * Follows Single Responsibility Principle (SRP).
 * Follows Dependency Inversion Principle (DIP) - depends on handler interfaces.
 *
 * Listens to external events and routes to appropriate handlers:
 * - auth.user.created → UserCreatedHandler
 */
@Injectable()
export class ComplianceConsumer implements OnModuleInit {
    private readonly logger = new Logger(ComplianceConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly userCreatedHandler: UserCreatedHandler,
    ) { }

    async onModuleInit(): Promise<void> {
        this.logger.log(`[DEBUG] Subscribing to Auth Topic: ${AuthTopics.USER_CREATED}`);

        // Subscribe to auth.user.created
        this.kafka.subscribe(
            AuthTopics.USER_CREATED,
            this.userCreatedHandler.handle.bind(this.userCreatedHandler),
        );

        // Start consuming
        await this.kafka.startConsuming();

        this.logger.log(
            `Compliance consumer subscribed to topics: ${AuthTopics.USER_CREATED}`,
        );
    }
}
