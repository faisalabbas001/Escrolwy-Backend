import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, CompressionTypes, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { BaseEvent, EventMetadata } from '../schemas';
import { AllTopics } from '../constants';
import { SchemaValidator } from '../schemas';

export interface ProducerConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

/**
 * Kafka Producer
 *
 * Handles all event publishing to Kafka.
 * Used by all services to produce events.
 */
@Injectable()
export class KafkaProducer implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducer.name);
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor(private readonly config: ProducerConfig) {
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

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
      maxInFlightRequests: 5,
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log(`✅ Kafka Producer connected (${this.config.clientId})`);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to connect producer (${this.config.clientId}) to brokers [${this.config.brokers.join(
          ', ',
        )}]: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await this.producer.disconnect();
    this.isConnected = false;
    this.logger.log('Kafka Producer disconnected');
  }

  /**
   * Produce a single event
   */
  async produce<T>(
    topic: AllTopics | string,
    payload: T,
    partitionKey: string,
    correlationId?: string,
  ): Promise<string> {
    await this.ensureConnected();

    const eventId = uuidv4();
    const metadata: EventMetadata = {
      eventId,
      timestamp: new Date().toISOString(),
      eventType: topic,
      source: this.config.clientId,
      version: '1.0.0',
      correlationId,
    };

    const event: BaseEvent<T> = { metadata, payload };

    // Validate before sending
    if (!SchemaValidator.validateEvent(event)) {
      throw new Error(`Invalid event structure for topic ${topic}`);
    }

    await this.producer.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key: partitionKey,
          value: JSON.stringify(event),
          headers: {
            eventId,
            eventType: topic,
            source: this.config.clientId,
          },
        },
      ],
    });

    this.logger.debug(`Produced event ${eventId} to ${topic}`);
    return eventId;
  }

  /**
   * Produce multiple events in batch
   */
  async produceBatch<T>(
    events: Array<{
      topic: AllTopics | string;
      payload: T;
      partitionKey: string;
      correlationId?: string;
    }>,
  ): Promise<string[]> {
    await this.ensureConnected();

    const eventIds: string[] = [];
    const topicMessages = new Map<string, any[]>();

    for (const e of events) {
      const eventId = uuidv4();
      eventIds.push(eventId);

      const metadata: EventMetadata = {
        eventId,
        timestamp: new Date().toISOString(),
        eventType: e.topic,
        source: this.config.clientId,
        version: '1.0.0',
        correlationId: e.correlationId,
      };

      const event: BaseEvent<T> = { metadata, payload: e.payload };
      const messages = topicMessages.get(e.topic) || [];
      messages.push({
        key: e.partitionKey,
        value: JSON.stringify(event),
        headers: {
          eventId,
          eventType: e.topic,
          source: this.config.clientId,
        },
      });
      topicMessages.set(e.topic, messages);
    }

    const topicMessagesArray = Array.from(topicMessages.entries()).map(
      ([topic, messages]) => ({ topic, messages }),
    );

    await this.producer.sendBatch({
      topicMessages: topicMessagesArray,
      compression: CompressionTypes.GZIP,
    });

    this.logger.debug(`Produced batch of ${events.length} events`);
    return eventIds;
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

