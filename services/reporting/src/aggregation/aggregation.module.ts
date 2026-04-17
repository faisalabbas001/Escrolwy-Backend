import { Global, Module } from '@nestjs/common';
import { AggregationService } from './aggregation.service';

/**
 * Aggregation Module
 *
 * Global module for data aggregation from Kafka events.
 */
@Global()
@Module({
    providers: [AggregationService],
    exports: [AggregationService],
})
export class AggregationModule { }
