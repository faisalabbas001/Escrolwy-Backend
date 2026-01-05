import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis Module
 *
 * Provides Redis queue operations for pushing raw transfer events.
 * Global module - available throughout the application.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

