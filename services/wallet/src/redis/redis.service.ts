import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { WalletConfigService } from '../config';

/**
 * Raw Transfer Event from Redis Queue
 * Matches the format pushed by listener-engine
 */
export interface RawTransferEvent {
  chain: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress: string;
  timestamp: number;
}

/**
 * Redis Service
 *
 * Handles Redis operations for the Wallet Service:
 * - BLPOP consumer for raw blockchain events
 * - Connection management
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;
  private isShuttingDown = false;

  constructor(private readonly walletConfig: WalletConfigService) {}

  async onModuleInit() {
    const redisUrl = this.walletConfig.getRedisUrl();

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) {
          this.logger.error('Redis connection failed after 10 retries');
          return null;
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
    this.isShuttingDown = true;
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.redis?.status === 'ready';
  }

  /**
   * Check if service is shutting down
   */
  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * BLPOP from multiple queues (blocking pop)
   * Returns the first available event from any of the specified queues
   *
   * @param queues - Array of queue names to listen to
   * @param timeoutSeconds - Timeout in seconds (0 = block forever)
   * @returns Tuple of [queueName, event] or null if timeout
   */
  async blpop(
    queues: string[],
    timeoutSeconds: number = 5,
  ): Promise<{ queue: string; event: RawTransferEvent } | null> {
    if (this.isShuttingDown) {
      return null;
    }

    try {
      const result = await this.redis.blpop(...queues, timeoutSeconds);

      if (!result) {
        return null;
      }

      const [queue, eventJson] = result;
      const event = JSON.parse(eventJson) as RawTransferEvent;

      this.logger.debug(`Received event from ${queue}: tx=${event.txHash}`);

      return { queue, event };
    } catch (error) {
      if (!this.isShuttingDown) {
        this.logger.error(`BLPOP error: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Get the current length of a queue
   */
  async getQueueLength(queueName: string): Promise<number> {
    return this.redis.llen(queueName);
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis {
    return this.redis;
  }
}

