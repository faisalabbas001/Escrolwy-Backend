/**
 * Auth Service - Kafka Integration
 *
 * Uses @escrowly/kafka-core for centralized Kafka infrastructure.
 * Uses @escrowly/kafka-publisher for reliable event publishing.
 *
 * Architecture matches Ledger Service pattern for consistency.
 */

export * from './kafka-events.module';
export * from './auth-event.producer';
export * from './consumers';
export * from './prisma-outbox.adapter';
