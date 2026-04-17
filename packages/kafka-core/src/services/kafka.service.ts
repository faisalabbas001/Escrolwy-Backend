import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaProducer, ProducerConfig } from './kafka.producer';
import { KafkaConsumer, ConsumerConfig, EventHandler } from './kafka.consumer';
import { BaseEvent } from '../schemas';
import { AllTopics } from '../constants';

export interface KafkaServiceConfig {
  clientId: string;
  groupId: string;
  brokers: string;
  enabled?: boolean;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

/**
 * Kafka Service
 *
 * High-level service combining producer and consumer.
 * Use this as the main entry point for Kafka operations.
 *
 * @example
 * ```typescript
 * // Produce
 * await kafkaService.produce(EscrowTopics.CREATED, payload, escrowId);
 *
 * // Consume
 * kafkaService.subscribe(EscrowTopics.CREATED, async (event) => {
 *   console.log('Escrow created:', event.payload);
 * });
 * await kafkaService.startConsuming();
 * ```
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: KafkaProducer;
  private consumer: KafkaConsumer;
  private readonly enabled: boolean;
  private readonly brokers: string[];

  constructor(private readonly config: KafkaServiceConfig) {
    this.enabled = config.enabled ?? true;
    this.brokers = this.normalizeBrokers(config.brokers);

    const producerConfig: ProducerConfig = {
      clientId: config.clientId,
      brokers: this.brokers,
      ssl: config.ssl,
      sasl: config.sasl,
    };

    const consumerConfig: ConsumerConfig = {
      clientId: config.clientId,
      groupId: config.groupId,
      brokers: this.brokers,
      ssl: config.ssl,
      sasl: config.sasl,
    };

    this.producer = new KafkaProducer(producerConfig);
    this.consumer = new KafkaConsumer(consumerConfig);
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('⚠️ Kafka is disabled');
      return;
    }
    // Producer connects lazily on first produce
    this.logger.log('KafkaService initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  /**
   * Check if Kafka is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  // ==========================================
  // PRODUCER METHODS
  // ==========================================

  /**
   * Produce a single event
   */
  async produce<T>(
    topic: AllTopics | string,
    payload: T,
    partitionKey: string,
    correlationId?: string,
  ): Promise<string | null> {
    if (!this.enabled) {
      this.logger.debug(`Kafka disabled, skipping: ${topic}`);
      return null;
    }
    return this.producer.produce(topic, payload, partitionKey, correlationId);
  }

  /**
   * Produce multiple events
   */
  async produceBatch<T>(
    events: Array<{
      topic: AllTopics | string;
      payload: T;
      partitionKey: string;
      correlationId?: string;
    }>,
  ): Promise<string[]> {
    if (!this.enabled) {
      this.logger.debug(`Kafka disabled, skipping batch of ${events.length}`);
      return [];
    }
    return this.producer.produceBatch(events);
  }

  // ==========================================
  // CONSUMER METHODS
  // ==========================================

  /**
   * Subscribe to a topic
   */
  subscribe<T>(topic: AllTopics | string, handler: EventHandler<T>): void {
    if (!this.enabled) {
      this.logger.debug(`Kafka disabled, not subscribing to: ${topic}`);
      return;
    }
    this.consumer.subscribe(topic, handler);
  }

  /**
   * Start consuming subscribed topics
   */
  async startConsuming(): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Kafka disabled, not consuming');
      return;
    }
    await this.consumer.startConsuming();
  }

  /**
   * Get raw producer (for advanced usage)
   */
  getProducer(): KafkaProducer {
    return this.producer;
  }

  /**
   * Get raw consumer (for advanced usage)
   */
  getConsumer(): KafkaConsumer {
    return this.consumer;
  }

  /**
   * Normalize broker strings:
   * - split on commas
   * - trim whitespace
   * - drop empties
   * - ensure a port (defaults to 9092)
   */
  private normalizeBrokers(brokers: string, defaultPort = 9092): string[] {
    const normalized = brokers
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => (b.includes(':') ? b : `${b}:${defaultPort}`));

    if (normalized.length === 0) {
      this.logger.warn(
        'Kafka brokers not set or empty; defaulting to localhost:9092',
      );
      return [`localhost:${defaultPort}`];
    }

    return normalized;
  }
}

