import { Injectable, Logger } from '@nestjs/common';
import {
  KafkaService,
  WalletTopics,
  WalletCreatedPayload,
  DepositDetectedPayload,
  DepositConfirmedPayload,
  WithdrawalCompletedPayload,
  WithdrawalFailedPayload,
  SweepCompletedPayload,
  PayoutPermanentlyFailedPayload,
  SweepFailedPayload,
  HotToColdCompletedPayload,
  HotToColdFailedPayload,
} from '@escrowly/kafka-core';
import { OutboxRepository } from './outbox.repository';

/**
 * Wallet Event Producer
 *
 * Produces Kafka events for wallet operations.
 * All methods are fire-and-forget - failures are logged and persisted to outbox.
 */
@Injectable()
export class WalletEventProducer {
  private readonly logger = new Logger(WalletEventProducer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  // ==========================================
  // WALLET EVENTS
  // ==========================================

  async walletCreated(
    userId: string,
    wallets: Array<{ chain: string; depositAddress: string }>,
    correlationId?: string,
  ): Promise<void> {
    const payload: WalletCreatedPayload = {
      userId,
      wallets,
      createdAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.WALLET_CREATED, userId, payload, correlationId);
  }

  // ==========================================
  // DEPOSIT EVENTS
  // ==========================================

  async depositDetected(
    userId: string,
    depositId: string,
    chain: string,
    asset: string,
    amount: string,
    txHash: string,
    blockNumber: number,
    depositAddress: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: DepositDetectedPayload = {
      userId,
      depositId,
      chain,
      asset,
      amount,
      txHash,
      blockNumber,
      depositAddress,
      detectedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.DEPOSIT_DETECTED, userId, payload, correlationId);
  }

  async depositConfirmed(
    userId: string,
    depositId: string,
    chain: string,
    asset: string,
    amount: string,
    txHash: string,
    blockNumber: number,
    depositAddress: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: DepositConfirmedPayload = {
      userId,
      depositId,
      chain,
      asset,
      amount,
      txHash,
      blockNumber,
      depositAddress,
      confirmedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.DEPOSIT_CONFIRMED, userId, payload, correlationId);
  }

  // ==========================================
  // WITHDRAWAL EVENTS
  // ==========================================

  async withdrawalCompleted(
    payoutRequestId: string,
    userId: string,
    chain: string,
    asset: string,
    amount: string,
    destinationAddress: string,
    txHash: string,
    blockNumber: number,
    gasUsed: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: WithdrawalCompletedPayload = {
      payoutRequestId,
      userId,
      chain,
      asset,
      amount,
      destinationAddress,
      txHash,
      blockNumber,
      gasUsed,
      completedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.WITHDRAWAL_COMPLETED, userId, payload, correlationId);
  }

  async withdrawalFailed(
    payoutRequestId: string,
    userId: string,
    chain: string,
    asset: string,
    amount: string,
    destinationAddress: string,
    errorMessage: string,
    attemptNumber: number,
    correlationId?: string,
  ): Promise<void> {
    const payload: WithdrawalFailedPayload = {
      payoutRequestId,
      userId,
      chain,
      asset,
      amount,
      destinationAddress,
      errorMessage,
      attemptNumber,
      failedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.WITHDRAWAL_FAILED, userId, payload, correlationId);
  }

  // ==========================================
  // SWEEP EVENTS
  // ==========================================

  async sweepCompleted(
    walletId: string,
    userId: string,
    chain: string,
    asset: string,
    amount: string,
    fromAddress: string,
    toAddress: string,
    txHash: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: SweepCompletedPayload = {
      walletId,
      userId,
      chain,
      asset,
      amount,
      fromAddress,
      toAddress,
      txHash,
      completedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.SWEEP_COMPLETED, userId, payload, correlationId);
  }

  async sweepFailed(
    walletId: string,
    depositId: string,
    userId: string,
    chain: string,
    asset: string,
    amount: string,
    fromAddress: string,
    toAddress: string,
    errorMessage: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: SweepFailedPayload = {
      walletId,
      depositId,
      userId,
      chain,
      asset,
      amount,
      fromAddress,
      toAddress,
      errorMessage,
      failedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.SWEEP_FAILED, userId, payload, correlationId);
  }

  // ==========================================
  // PAYOUT EVENTS
  // ==========================================

  async payoutPermanentlyFailed(
    payoutRequestId: string,
    userId: string,
    chain: string,
    asset: string,
    amount: string,
    destinationAddress: string,
    totalAttempts: number,
    lastErrorMessage: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: PayoutPermanentlyFailedPayload = {
      payoutRequestId,
      userId,
      chain,
      asset,
      amount,
      destinationAddress,
      totalAttempts,
      lastErrorMessage,
      failedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.PAYOUT_PERMANENTLY_FAILED, userId, payload, correlationId);
  }

  // ==========================================
  // HOT-TO-COLD EVENTS
  // ==========================================

  async hotToColdCompleted(
    chain: string,
    asset: string,
    amount: string,
    fromAddress: string,
    toAddress: string,
    txHash: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: HotToColdCompletedPayload = {
      chain,
      asset,
      amount,
      fromAddress,
      toAddress,
      txHash,
      completedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.HOT_TO_COLD_COMPLETED, chain, payload, correlationId);
  }

  async hotToColdFailed(
    chain: string,
    asset: string,
    amount: string,
    fromAddress: string,
    toAddress: string,
    errorMessage: string,
    correlationId?: string,
  ): Promise<void> {
    const payload: HotToColdFailedPayload = {
      chain,
      asset,
      amount,
      fromAddress,
      toAddress,
      errorMessage,
      failedAt: new Date().toISOString(),
    };
    await this.produce(WalletTopics.HOT_TO_COLD_FAILED, chain, payload, correlationId);
  }

  // ==========================================
  // CORE PRODUCE METHOD
  // ==========================================

  private async produce<T>(
    topic: WalletTopics,
    partitionKey: string,
    payload: T,
    correlationId?: string,
  ): Promise<void> {
    try {
      const eventId = await this.kafka.produce(topic, payload, partitionKey, correlationId);
      if (eventId) {
        this.logger.debug(`Produced ${topic} (${eventId}) for ${partitionKey}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to produce ${topic}: ${error.message}`);
      // Persist to outbox so it can be retried by the publisher
      await this.outboxRepository.save(topic, partitionKey, payload, error?.message, 'failed');
      // Don't throw - event production shouldn't block business logic
    }
  }
}

