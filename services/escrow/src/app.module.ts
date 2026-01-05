import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthCommonModule } from '@escrowly/auth-common';
import { KafkaModule } from '@escrowly/kafka-core';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { EscrowModule } from './modules/escrows/escrow.module';
import { PrismaOutboxAdapter } from './kafka/prisma-outbox.adapter';

/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - AuthCommonModule: Guards and decorators
 * - KafkaModule: Centralized Kafka infrastructure
 * - DatabaseModule: Prisma ORM configuration
 * - HealthModule: Health check endpoints
 * - EscrowModule: Escrow service endpoints
 */
@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Auth common module (guards, decorators)
    AuthCommonModule,

    // Kafka module (centralized)
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const brokersStr = config.get<string>('KAFKA_BROKERS', 'localhost:19092');
        const brokersArray = brokersStr
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
          .map((b) => (b.includes(':') ? b : `${b}:9092`));

        // eslint-disable-next-line no-console
        console.log('[KafkaConfig] brokers =', brokersArray);
        const enabled = config.get('KAFKA_ENABLED', 'false') === 'true';
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

    // Database connectivity
    DatabaseModule,

    // Kafka Publisher Module (reliable event publishing)
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

    // Health check module
    HealthModule,

    // Escrow module
    EscrowModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
