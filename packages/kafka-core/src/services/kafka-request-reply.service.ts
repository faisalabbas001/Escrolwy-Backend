import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, Producer, EachMessagePayload, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { BaseEvent } from '../schemas';

export interface RequestReplyConfig {
  clientId: string;
  brokers: string[];
  replyTopic: string; // e.g., 'escrow-service.replies'
  timeoutMs?: number; // default 30s
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

interface PendingRequest {
  correlationId: string;
  resolve: (value: BaseEvent) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Kafka Request/Reply Service
 *
 * Implements synchronous request/reply pattern over Kafka for hard dependencies.
 * Use when you need a response before proceeding.
 *
 * @example
 * ```typescript
 * const reply = await requestReply.request(
 *   'ledger.balance.check',
 *   { walletId: '123' },
 *   'wallet-123',
 * );
 * ```
 */
@Injectable()
export class KafkaRequestReplyService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaRequestReplyService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private isConnected = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly timeoutMs: number;

  constructor(private readonly config: RequestReplyConfig) {
    this.timeoutMs = config.timeoutMs ?? 30000;

    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      logLevel: logLevel.WARN,
      ssl: config.ssl,
      sasl: config.sasl as any,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
    });

    this.consumer = this.kafka.consumer({
      groupId: `${config.clientId}-request-reply`,
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.producer.connect();
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [this.config.replyTopic],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async (payload) => {
          await this.handleReply(payload);
        },
      });

      this.isConnected = true;
      this.logger.log(
        `✅ Request/Reply service connected (reply topic: ${this.config.replyTopic})`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to connect request/reply service: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    // Reject all pending requests
    for (const [correlationId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(
        new Error(`Request/Reply service disconnected: ${correlationId}`),
      );
    }
    this.pendingRequests.clear();

    await this.consumer.disconnect();
    await this.producer.disconnect();
    this.isConnected = false;
    this.logger.log('Request/Reply service disconnected');
  }

  /**
   * Send a request and wait for reply
   */
  async request<TRequest, TReply>(
    topic: string,
    payload: TRequest,
    partitionKey: string,
    timeoutMs?: number,
  ): Promise<BaseEvent<TReply>> {
    await this.ensureConnected();

    const correlationId = uuidv4();
    const timeout = timeoutMs ?? this.timeoutMs;

    return new Promise<BaseEvent<TReply>>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(
          new Error(
            `Request timeout after ${timeout}ms for topic ${topic} (correlationId: ${correlationId})`,
          ),
        );
      }, timeout);

      this.pendingRequests.set(correlationId, {
        correlationId,
        resolve: resolve as (value: BaseEvent) => void,
        reject,
        timeout: timeoutHandle,
      });

      this.producer
        .send({
          topic,
          messages: [
            {
              key: partitionKey,
              value: JSON.stringify(payload),
              headers: {
                correlationId,
                replyTo: this.config.replyTopic,
              },
            },
          ],
        })
        .catch((error) => {
          this.pendingRequests.delete(correlationId);
          clearTimeout(timeoutHandle);
          reject(
            new Error(
              `Failed to send request to ${topic}: ${error.message}`,
            ),
          );
        });
    });
  }

  /**
   * Send a reply to a request
   */
  async reply(
    replyTo: string,
    correlationId: string,
    payload: unknown,
    partitionKey?: string,
  ): Promise<void> {
    await this.ensureConnected();

    try {
      await this.producer.send({
        topic: replyTo,
        messages: [
          {
            key: partitionKey ?? correlationId,
            value: JSON.stringify(payload),
            headers: {
              correlationId,
            },
          },
        ],
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to send reply to ${replyTo} (correlationId: ${correlationId}): ${error.message}`,
      );
      throw error;
    }
  }

  private async handleReply(payload: EachMessagePayload): Promise<void> {
    const { message } = payload;
    if (!message.value) return;

    const correlationId = message.headers?.correlationId?.toString();
    if (!correlationId) {
      this.logger.warn('Reply received without correlationId');
      return;
    }

    const pending = this.pendingRequests.get(correlationId);
    if (!pending) {
      this.logger.warn(
        `Reply received for unknown correlationId: ${correlationId}`,
      );
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(correlationId);

    try {
      const reply = JSON.parse(message.value.toString()) as BaseEvent;
      pending.resolve(reply);
    } catch (error: any) {
      pending.reject(
        new Error(`Failed to parse reply: ${error.message}`),
      );
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

