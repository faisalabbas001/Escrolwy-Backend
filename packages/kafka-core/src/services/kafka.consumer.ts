import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { BaseEvent } from '../schemas';
import { AllTopics } from '../constants';
import { SchemaValidator } from '../schemas';

export interface ConsumerConfig {
  clientId: string;
  groupId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

export type EventHandler<T = unknown> = (
  event: BaseEvent<T>,
  raw: EachMessagePayload,
) => Promise<void>;

/**
 * Kafka Consumer
 *
 * Handles event consumption from Kafka.
 * Supports multiple topic subscriptions with handlers.
 */
@Injectable()
export class KafkaConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumer.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected = false;
  private handlers = new Map<string, EventHandler[]>();

  constructor(private readonly config: ConsumerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      logLevel: logLevel.WARN,
      ssl: config.ssl,
      sasl: config.sasl as any,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.consumer.connect();
      this.isConnected = true;
      this.logger.log(`✅ Kafka Consumer connected (${this.config.groupId})`);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to connect consumer (${this.config.groupId}) to brokers [${this.config.brokers.join(
          ', ',
        )}]: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await this.consumer.disconnect();
    this.isConnected = false;
    this.logger.log('Kafka Consumer disconnected');
  }

  /**
   * Subscribe to a topic with a handler
   */
  subscribe<T>(topic: AllTopics | string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(topic) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(topic, handlers);
    this.logger.log(`Subscribed to topic: ${topic}`);
  }

  /**
   * Start consuming messages
   */
  async startConsuming(): Promise<void> {
    await this.ensureConnected();

    const topics = Array.from(this.handlers.keys());
    if (topics.length === 0) {
      this.logger.warn('No topics to subscribe to');
      return;
    }

    await this.consumer.subscribe({
      topics,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async (payload) => {
        this.logger.log(`[LOW-LEVEL DEBUG] RECEIVED MESSAGE ON TOPIC: ${payload.topic}`);
        await this.handleMessage(payload);
      },
    });

    this.logger.log(`Consuming from topics: ${topics.join(', ')}`);
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, message } = payload;

    if (!message.value) {
      this.logger.warn(`Empty message received on ${topic}`);
      return;
    }

    const messageStr = message.value.toString();
    const event = SchemaValidator.parseEvent(messageStr);

    if (!event) {
      this.logger.error(`Invalid event on ${topic}: ${messageStr.substring(0, 100)}`);
      return;
    }

    const handlers = this.handlers.get(topic) || [];
    if (handlers.length === 0) {
      this.logger.warn(`No handlers for topic: ${topic}`);
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(event, payload);
        this.logger.debug(`Handled event ${event.metadata.eventId} from ${topic}`);
      } catch (error: any) {
        this.logger.error(
          `Handler error for ${event.metadata.eventId}: ${error.message}`,
        );
        // Don't rethrow - other handlers should still run
      }
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }
}

