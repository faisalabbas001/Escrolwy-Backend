import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecretsModule } from '@escrowly/shared-config';
import { KafkaModule } from '@escrowly/kafka-core';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { AuthCommonModule } from '@escrowly/auth-common';
import { PrismaModule } from './prisma';
import { HealthModule } from './health';
import { KycModule } from './kyc';
import { LimitsModule } from './limits';
import { AdminModule } from './admin';
import { AuditModule } from './audit';
import { KafkaEventsModule, PrismaOutboxAdapter } from './kafka';

/**
 * Root Application Module for Compliance Service
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - SecretsModule: Shared secrets management (from @escrowly/shared-config)
 * - PrismaModule: Database connection (compliance_db schema)
 * - HealthModule: Health check endpoints
 * - KycModule: KYC lifecycle management
 * - LimitsModule: User limits S2S APIs
 * - KafkaModule: Kafka connectivity
 * - KafkaPublisherModule: Transactional outbox publishing
 * - KafkaEventsModule: Event producer and adapter
 */
@Module({
    imports: [
        // Load environment variables globally
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            cache: true,
        }),

        // Secrets management (global) - abstracts Secrets Manager / .env
        SecretsModule,

        // Database module (global)
        PrismaModule,

        // Health check module
        HealthModule,

        // KYC module
        KycModule,

        // Limits module (S2S APIs)
        LimitsModule,

        // Admin module
        AdminModule,

        // Audit module (global)
        AuditModule,

        // Auth common module (provides JwtAuthGuard, RolesGuard)
        AuthCommonModule,

        // Kafka publisher with outbox pattern
        KafkaPublisherModule.forRoot({
            adapter: PrismaOutboxAdapter,
            config: {
                pollingIntervalMs: 2000,
                batchSize: 20,
                maxRetries: 5,
                baseBackoffMs: 5000,
                maxBackoffMs: 60000,
            },
        }),

        // Kafka core module
        KafkaModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => {
                const brokersStr = config.get<string>('KAFKA_BROKERS', 'localhost:9092');
                const brokersArray = brokersStr
                    .split(',')
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((b) => (b.includes(':') ? b : `${b}:9092`));

                console.log('[KafkaConfig] brokers =', brokersArray);
                const enabled = config.get<string>('KAFKA_ENABLED', 'true') === 'true';
                console.log('[KafkaConfig] enabled =', enabled);

                return {
                    clientId: 'compliance-service',
                    groupId: 'compliance-consumer-group',
                    brokers: brokersArray.join(','),
                    enabled,
                };
            },
            inject: [ConfigService],
        }),

        // Kafka events module
        KafkaEventsModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
