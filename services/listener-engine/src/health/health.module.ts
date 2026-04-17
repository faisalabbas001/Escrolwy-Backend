import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ListenerModule } from '../listener';

/**
 * Health Module
 *
 * Provides health check endpoints for the listener-engine service.
 */
@Module({
  imports: [ListenerModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}

