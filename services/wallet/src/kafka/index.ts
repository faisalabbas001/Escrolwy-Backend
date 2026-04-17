/**
 * Wallet Service - Kafka Integration
 *
 * Uses @escrowly/kafka-core for centralized Kafka infrastructure.
 * Uses @escrowly/kafka-publisher for reliable event publishing.
 */

export * from './wallet-event-producer';
export * from './prisma-outbox.adapter';
export * from './outbox.repository';
export * from './kafka-integration.module';

