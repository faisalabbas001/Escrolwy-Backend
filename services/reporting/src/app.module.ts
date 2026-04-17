import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsModule } from '@escrowly/shared-config';
import { KafkaModule } from '@escrowly/kafka-core';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { AuthCommonModule } from '@escrowly/auth-common';

// Internal Modules
import { PrismaModule } from './prisma';
import { PrismaOutboxAdapter } from './kafka/prisma-outbox.adapter';
import { HealthModule } from './health';
import { KafkaEventsModule } from './kafka';
import { AggregationModule } from './aggregation';
import { ReportsModule } from './reports';
import { MetricsModule } from './metrics';
import { AlertsModule } from './alerts';
import { ExportsModule } from './exports';
import { MonitoringModule } from './monitoring/monitoring.module';

// Controllers & Services
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * App Module
 *
 * Root module for the Reporting Service.
 * READ-ONLY analytics and observer service.
 *
 * Features:
 * - Daily metrics aggregation
 * - System health monitoring
 * - Alert management
 * - Data exports
 * - Kafka event consumption
 */
@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '.env.local'],
        }),

        // Secrets management (global) - abstracts Secrets Manager / .env
        SecretsModule,

        // Auth Common (guards, decorators)
        AuthCommonModule,

        // Database
        PrismaModule,

        // Kafka Infrastructure
        KafkaModule.forRootAsync({
            useFactory: () => ({
                clientId: process.env.KAFKA_CLIENT_ID || 'reporting-service',
                brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
                groupId: process.env.KAFKA_GROUP_ID || 'reporting-service-group',
                enabled: process.env.KAFKA_ENABLED === 'true',
            }),
        }),

        // Kafka Publisher (Transactional Outbox)
        KafkaPublisherModule.forRoot({
            adapter: PrismaOutboxAdapter,
            config: {
                pollingIntervalMs: 2000,
                batchSize: 20,
                maxRetries: 5,
            },
        }),

        // Internal Modules
        HealthModule,
        KafkaEventsModule,
        AggregationModule,
        ReportsModule,
        MetricsModule,
        AlertsModule,
        ExportsModule,
        MonitoringModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
