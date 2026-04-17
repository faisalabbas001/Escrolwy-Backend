import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SecretsModule } from '@escrowly/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { HealthModule } from './health';
import { AuthModule } from './auth';
import { AdminModule } from './admin/admin.module';
import { InternalModule } from './internal/internal.module';
import { KafkaEventsModule } from './kafka';
import { UserStatusChecker } from './auth/user-status.checker';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { PrismaOutboxAdapter } from './kafka/prisma-outbox.adapter';
import { KafkaModule } from '@escrowly/kafka-core';
import { ConfigService } from '@nestjs/config';
/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - SecretsModule: Shared secrets management (from @escrowly/shared-config)
 * - PrismaModule: Database connection (auth_db schema)
 * - HealthModule: Health check endpoints
 * - AuthModule: Authentication (signup, login, tokens)
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

    // Authentication module
    AuthModule,

    // Admin module
    AdminModule,

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
    // Kafka module (centralized)
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const brokersStr = config.get<string>('KAFKA_BROKERS', 'localhost:9092');
        const brokersArray = brokersStr
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
          .map((b) => (b.includes(':') ? b : `${b}:9092`));

        // eslint-disable-next-line no-console
        console.log('[KafkaConfig] brokers =', brokersArray);
        const enabled = config.get<boolean>('KAFKA_ENABLED', true);
        // eslint-disable-next-line no-console
        console.log('[KafkaConfig] enabled =', enabled);

        return {
          clientId: 'escrow-service',
          groupId: 'escrow-consumer-group',
          brokers: brokersArray.join(','), // KafkaModule options expect string; service normalizes to array
          enabled,
        };
      },
      inject: [ConfigService],
    }),



    // Internal service-to-service module
    InternalModule,

    // Kafka events module (global - provides producer and consumer)
    KafkaEventsModule,
  ],





  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
