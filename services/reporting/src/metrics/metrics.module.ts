import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Metrics Module
 *
 * READ-ONLY module for system and infrastructure health metrics.
 */
@Module({
    controllers: [MetricsController],
    providers: [MetricsService],
    exports: [MetricsService],
})
export class MetricsModule { }
