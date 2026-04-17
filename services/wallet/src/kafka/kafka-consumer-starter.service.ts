import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { KafkaConsumer } from '@escrowly/kafka-core';

/**
 * Kafka Consumer Starter Service
 *
 * Ensures that Kafka consumer starts consuming messages after all
 * subscriptions have been registered. Uses OnApplicationBootstrap
 * which runs after all onModuleInit hooks have completed.
 */
@Injectable()
export class KafkaConsumerStarterService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KafkaConsumerStarterService.name);

  constructor(private readonly kafkaConsumer: KafkaConsumer) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      this.logger.log('Starting Kafka consumer...');
      await this.kafkaConsumer.startConsuming();
      this.logger.log('✅ Kafka consumer started');
    } catch (error: any) {
      this.logger.error(`Failed to start Kafka consumer: ${error.message}`);
      throw error;
    }
  }
}

