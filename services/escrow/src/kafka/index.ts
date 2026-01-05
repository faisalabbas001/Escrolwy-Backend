/**
 * Escrow Service - Kafka Integration
 *
 * Uses @escrowly/kafka-core for centralized Kafka infrastructure.
 * Uses @escrowly/kafka-publisher for reliable event publishing.
 */

export * from './produce-events';
export * from './prisma-outbox.adapter';
