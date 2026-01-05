import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis Module
 *
 * Global module that provides RedisService for queue operations.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

