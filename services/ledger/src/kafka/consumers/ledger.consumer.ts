import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService, LedgerTopics, EscrowTopics } from '@escrowly/kafka-core';
import {
  TransactionConfirmedHandler,
  TransactionFailedHandler,
  PaymentCompletedHandler,
  EscrowCompletedHandler,
  UserDepositHandler,
  EscrowRefundedHandler,
  EscrowCancelledHandler,
  DisputeResolvedHandler,
} from './handlers';

/**
 * Ledger Consumer
 *
 * Single Responsibility: Orchestrates Kafka event subscriptions
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - depends on handler interfaces
 *
 * Coordinates:
 * - Event subscription (via KafkaService)
 * - Event routing (via handlers)
 *
 * Note: Does NOT recalculate balances (balances are source of truth from journal entries)
 */
@Injectable()
export class LedgerConsumer implements OnModuleInit {
  private readonly logger = new Logger(LedgerConsumer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly transactionConfirmedHandler: TransactionConfirmedHandler,
    private readonly transactionFailedHandler: TransactionFailedHandler,
    private readonly paymentCompletedHandler: PaymentCompletedHandler,
    private readonly escrowCompletedHandler: EscrowCompletedHandler,
    private readonly userDepositHandler: UserDepositHandler,
    private readonly escrowRefundedHandler: EscrowRefundedHandler,
    private readonly escrowCancelledHandler: EscrowCancelledHandler,
    private readonly disputeResolvedHandler: DisputeResolvedHandler,
  ) {}

  async onModuleInit() {
    this.logger.log(
      `Kafka enabled: ${this.kafka.isEnabled ?? 'unknown'}; subscribing to escrow.payment.completed, transaction events.`,
    );



    // Subscribe to ledger transaction events using topics from kafka-core
    this.kafka.subscribe(
      LedgerTopics.TRANSACTION_CONFIRMED,
      this.transactionConfirmedHandler.handle.bind(this.transactionConfirmedHandler),
    );

    this.kafka.subscribe(
      LedgerTopics.TRANSACTION_FAILED,
      this.transactionFailedHandler.handle.bind(this.transactionFailedHandler),
    );

    this.kafka.subscribe(
      EscrowTopics.PAYMENT_COMPLETED,
      this.paymentCompletedHandler.handle.bind(this.paymentCompletedHandler),
    );

    this.kafka.subscribe(
      EscrowTopics.COMPLETED,
      this.escrowCompletedHandler.handle.bind(this.escrowCompletedHandler),
    );

    // Subscribe to user deposit events
    this.kafka.subscribe(
      'user.deposit',
      this.userDepositHandler.handle.bind(this.userDepositHandler),
    );

    // Subscribe to escrow refunded events
    this.kafka.subscribe(
      EscrowTopics.REFUNDED,
      this.escrowRefundedHandler.handle.bind(this.escrowRefundedHandler),
    );

    // Subscribe to escrow cancelled events
    this.kafka.subscribe(
      EscrowTopics.CANCELLED,
      this.escrowCancelledHandler.handle.bind(this.escrowCancelledHandler),
    );

    // Subscribe to escrow resolved events (dispute resolution)
    this.kafka.subscribe(
      EscrowTopics.RESOLVED,
      this.disputeResolvedHandler.handle.bind(this.disputeResolvedHandler),
    );

    await this.kafka.startConsuming();

    this.logger.log(
      `Ledger consumer subscribed to topics: ${LedgerTopics.TRANSACTION_CONFIRMED}, ${LedgerTopics.TRANSACTION_FAILED}, ${EscrowTopics.PAYMENT_COMPLETED}, ${EscrowTopics.COMPLETED}, ${EscrowTopics.REFUNDED}, ${EscrowTopics.CANCELLED}, ${EscrowTopics.RESOLVED}`,
    );
  }
}

