import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaModule, KafkaService, KafkaConsumer } from '@escrowly/kafka-core';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { PrismaOutboxAdapter } from './prisma-outbox.adapter';
import { OutboxRepository } from './outbox.repository';
import { WalletEventProducer } from './wallet-event-producer';
import { KafkaConsumerStarterService } from './kafka-consumer-starter.service';

/**
 * Kafka Integration Module
 *
 * Sets up Kafka producer, consumer, and outbox publisher for the Wallet Service.
 */
@Module({
  imports: [
    // Kafka core module with async configuration
    KafkaModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        clientId: configService.get<string>('SERVICE_NAME', 'wallet-service'),
        groupId: 'wallet-service-group',
        brokers: configService.get<string>('KAFKA_BROKERS', 'localhost:9092'),
        enabled: configService.get<string>('KAFKA_ENABLED', 'true') === 'true',
      }),
      inject: [ConfigService],
    }),

    // Kafka publisher module with outbox pattern
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
  ],
  providers: [
    PrismaOutboxAdapter,
    OutboxRepository,
    WalletEventProducer,
    // Provide KafkaConsumer by getting it from KafkaService
    {
      provide: KafkaConsumer,
      useFactory: (kafkaService: KafkaService) => {
        return kafkaService.getConsumer();
      },
      inject: [KafkaService],
    },
    // Service to start consuming after all subscriptions are registered
    KafkaConsumerStarterService,
  ],
  exports: [OutboxRepository, WalletEventProducer, KafkaConsumer],
})
export class KafkaIntegrationModule {}

