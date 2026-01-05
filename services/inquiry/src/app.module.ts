import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { SecretsModule } from '@escrowly/shared-config';
import { KafkaModule } from '@escrowly/kafka-core';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { StatusGuard } from '@escrowly/auth-common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { HealthModule } from './health';
import { InquiryModule } from './inquiry/inquiry.module';
import { UploadModule } from './upload';
import { PrismaOutboxAdapter } from './kafka';
import { UserStatusChecker } from './auth/user-status.checker';

/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - ScheduleModule: Scheduling for outbox processor
 * - SecretsModule: Shared secrets management (from @escrowly/shared-config)
 * - KafkaModule: Kafka producer/consumer integration
 * - KafkaPublisherModule: Outbox pattern publisher for reliable event delivery
 * - PrismaModule: Database connection (inquiry_db schema)
 * - HealthModule: Health check endpoints
 * - InquiryModule: Inquiry management module
 *
 * Global Guards:
 * - StatusGuard (from @escrowly/auth-common): Enforces user account status (LOCKED users blocked)
 *   This guard runs after JWT authentication and blocks LOCKED users from all protected routes.
 */
@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // Scheduling module for outbox processor
    ScheduleModule.forRoot(),

    // Secrets management (global) - abstracts Secrets Manager / .env
    SecretsModule,

    // Kafka module (global) - producer/consumer
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: config.get('KAFKA_CLIENT_ID', 'inquiry-service'),
        groupId: config.get('KAFKA_GROUP_ID', 'inquiry-consumer-group'),
        brokers: config.get('KAFKA_BROKERS', 'localhost:9092'),
        enabled: config.get('KAFKA_ENABLED', 'false') === 'true',
        ssl: config.get('KAFKA_SSL', 'false') === 'true',
        sasl: config.get('KAFKA_SASL_USERNAME')
          ? {
              mechanism: config.get('KAFKA_SASL_MECHANISM', 'plain') as
                | 'plain'
                | 'scram-sha-256'
                | 'scram-sha-512',
              username: config.get('KAFKA_SASL_USERNAME', ''),
              password: config.get('KAFKA_SASL_PASSWORD', ''),
            }
          : undefined,
      }),
      inject: [ConfigService],
    }),

    // Kafka Publisher module - Transactional Outbox Pattern
    // Uses PrismaOutboxAdapter for database operations
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

    // Database module (global)
    PrismaModule.forRoot(),

    // Health check module
    HealthModule,

    // Inquiry module
    InquiryModule,

    // Upload module for S3 file uploads
    UploadModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Status checker implementation for StatusGuard
    {
      provide: 'STATUS_CHECKER',
      useClass: UserStatusChecker,
    },
    // Global guard to enforce user status on all protected routes
    // This guard runs after JWT authentication (if configured)
    {
      provide: APP_GUARD,
      useClass: StatusGuard,
    },
  ],
})
export class AppModule {}
