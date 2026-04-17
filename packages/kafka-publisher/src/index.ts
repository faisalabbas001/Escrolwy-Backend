/**
 * @escrowly/kafka-publisher
 *
 * Reliable Kafka event publishing using the Transactional Outbox Pattern.
 *
 * This package provides:
 * - DB-agnostic outbox processing
 * - Automatic retry with exponential backoff
 * - Safe concurrent processing (multiple instances)
 * - Idempotent publishing
 *
 * @example
 * ```typescript
 * import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
 * import { PrismaOutboxAdapter } from './adapters/prisma-outbox.adapter';
 *
 * @Module({
 *   imports: [
 *     KafkaPublisherModule.forRoot({
 *       adapter: PrismaOutboxAdapter,
 *       config: {
 *         pollingIntervalMs: 2000,
 *         batchSize: 20,
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

// Module
export { KafkaPublisherModule } from './module/kafka-publisher.module';

// Services
export { PublisherService } from './services/publisher.service';
export { OutboxProcessorService } from './services/outbox-processor.service';

// Interfaces
export { OutboxAdapter, OutboxEvent, PublisherConfig } from './interfaces';

