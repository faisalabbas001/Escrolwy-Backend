import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;
  private readonly defaultTTL = 300; // 5 minutes default

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    // Use URL constructor to avoid option mismatches; defaults are fine
    this.redis = new Redis(redisUrl);

    try {
      await this.redis.connect();
      this.logger.log('Redis cache connected successfully');
    } catch (error) {
      this.logger.warn('Redis cache connection failed, caching disabled', error.message);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private isConnected(): boolean {
    return this.redis && this.redis.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected()) return null;
    
    try {
      const data = await this.redis.get(key);
      if (data) {
        this.logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(data);
      }
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.warn(`Cache get error: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    if (!this.isConnected()) return;
    
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.warn(`Cache set error: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected()) return;
    
    try {
      await this.redis.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.warn(`Cache del error: ${error.message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.isConnected()) return;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Cache DEL pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      this.logger.warn(`Cache delByPattern error: ${error.message}`);
    }
  }

  // Convenience methods for blogs
  async invalidateBlogCache(): Promise<void> {
    await this.delByPattern('blog:*');
  }

  // Convenience methods for help-desk
  async invalidateHelpDeskCache(): Promise<void> {
    await this.delByPattern('helpdesk:*');
  }
}

