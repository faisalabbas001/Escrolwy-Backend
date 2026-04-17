import { Module } from "@nestjs/common";
import { ProcessedEventsService } from "./processed-events.service";

/**
 * Processed Events Module
 *
 * Provides idempotency tracking for Kafka events.
 */
@Module({
  providers: [ProcessedEventsService],
  exports: [ProcessedEventsService],
})
export class ProcessedEventsModule {}

