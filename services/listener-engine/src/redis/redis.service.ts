import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RawTransferEvent } from '../listener/dto';

/**
 * Redis Service
 *
 * Handles Redis queue operations for pushing raw transfer events.
 * Each chain has its own queue (raw_events_eth, raw_events_bnb, etc.)
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) {
          this.logger.error('Redis connection failed after 10 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('✅ Connected to Redis');
    });

    this.redis.on('error', (err) => {
      this.logger.error('❌ Redis connection error:', err.message);
    });

    this.redis.on('reconnecting', () => {
      this.logger.warn('🔄 Reconnecting to Redis...');
    });
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Push a raw transfer event to the appropriate chain queue
   *
   * @param queueName - Queue name (e.g., raw_events_eth)
   * @param event - Raw transfer event data
   */
  async pushEvent(queueName: string, event: RawTransferEvent): Promise<void> {
    try {
      const eventJson = JSON.stringify(event);
      await this.redis.rpush(queueName, eventJson);
      // Use debug level to avoid cluttering logs (single events are less common)
      this.logger.debug(
        `Pushed event to ${queueName}: tx=${event.txHash}, logIndex=${event.logIndex}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to push event to ${queueName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Push multiple raw transfer events to the queue in a batch
   *
   * @param queueName - Queue name
   * @param events - Array of raw transfer events
   */
  async pushEvents(
    queueName: string,
    events: RawTransferEvent[],
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();
      for (const event of events) {
        pipeline.rpush(queueName, JSON.stringify(event));
      }
      await pipeline.exec();
      
      // Extract chain name from queueName (raw_events_eth -> eth) or use chain from first event
      const chainName = events[0]?.chain?.toUpperCase() || queueName.replace('raw_events_', '').toUpperCase();
      const blockNumber = events[0]?.blockNumber || 'unknown';
      
      // Log once per block: chain, block number, and event count
      this.logger.log(
        `📤 ${chainName} | Block ${blockNumber} | ${events.length} event${events.length > 1 ? 's' : ''}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to push batch events to ${queueName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get the current length of a queue
   *
   * @param queueName - Queue name
   * @returns Queue length
   */
  async getQueueLength(queueName: string): Promise<number> {
    return this.redis.llen(queueName);
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.redis?.status === 'ready';
  }

  /**
   * Get Redis client for advanced operations (if needed)
   */
  getClient(): Redis {
    return this.redis;
  }
}

