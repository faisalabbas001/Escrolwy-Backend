import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaConsumer, LedgerTopics, BaseEvent } from '@escrowly/kafka-core';
import { PrismaService } from '../prisma';
import { WalletEventProducer } from '../kafka';
import {
  EvmExecutorService,
  SolanaExecutorService,
  TronExecutorService,
  TransactionResult,
  PlatformKeyService,
} from '../crypto';
import {
  mapListenerChainToWalletChain,
  WalletChainId,
  EVM_TOKENS,
  SOL_TOKENS,
  TRC_TOKENS,
  WalletConfigService,
} from '../config';

/**
 * Withdrawal Requested Payload
 * Expected from ledger.external_payout_created topic
 * Note: amount can be number (from ExternalPayoutCreatedPayload) or string
 */
interface WithdrawalRequestedPayload {
  transferId: string;
  asset: string;
  amount: string | number; // Can be number from Kafka payload or string
  chain: string;
  senderId: string;
  destinationAddress: string;
  destinationChain: string;
  createdAt: string;
}

/**
 * Withdrawal Requested Consumer
 *
 * Consumes ledger.external_payout_created events from Kafka.
 * Executes on-chain withdrawals to external addresses.
 *
 * Flow:
 * 1. Receive ledger.external_payout_created event
 * 2. Check idempotency via event_id
 * 3. Create payout_request with status=pending
 * 4. Validate chain support and health
 * 5. Execute on-chain transaction
 * 6. Update payout_request with result
 * 7. On failure: create payout_attempt record
 * 8. Emit wallet.withdrawal.completed or wallet.withdrawal.failed
 */
@Injectable()
export class WithdrawalRequestedConsumer implements OnModuleInit {
  private readonly logger = new Logger(WithdrawalRequestedConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly prisma: PrismaService,
    private readonly walletEventProducer: WalletEventProducer,
    private readonly evmExecutor: EvmExecutorService,
    private readonly solanaExecutor: SolanaExecutorService,
    private readonly tronExecutor: TronExecutorService,
    private readonly walletConfig: WalletConfigService,
    private readonly platformKeyService: PlatformKeyService,
  ) {}

  async onModuleInit() {
    // Subscribe to ledger.external_payout_created topic
    this.kafkaConsumer.subscribe<WithdrawalRequestedPayload>(
      LedgerTopics.EXTERNAL_PAYOUT_CREATED,
      this.handleWithdrawalRequested.bind(this)
    );

    this.logger.log('✅ Subscribed to ledger.external_payout_created topic');
  }

  /**
   * Handle withdrawal requested event
   */
  private async handleWithdrawalRequested(
    event: BaseEvent<WithdrawalRequestedPayload>
  ): Promise<void> {
    const { metadata, payload } = event;
    const { eventId } = metadata;
    const { transferId, asset, amount: amountRaw, chain, senderId, destinationAddress } =
      payload;
    
    // Convert amount to string (payload has it as number, but we need string)
    const amount = typeof amountRaw === 'number' ? amountRaw.toString() : amountRaw;

    this.logger.log(
      `Processing withdrawal request ${transferId} for ${senderId}`
    );

    try {
      // Check idempotency - has this event already been processed?
      const existingPayout = await this.prisma.payoutRequest.findUnique({
        where: { eventId },
      });

      if (existingPayout) {
        this.logger.debug(`Withdrawal ${eventId} already processed, skipping`);
        return;
      }

      // Map chain to wallet chain ID
      const walletChain = mapListenerChainToWalletChain(chain);

      // Create payout request
      const payoutRequest = await this.prisma.payoutRequest.create({
        data: {
          eventId,
          userId: senderId,
          chain: walletChain,
          asset,
          amount,
          destinationAddress,
          status: 'pending',
        },
      });

      this.logger.log(`Created payout request ${payoutRequest.id}`);

      // Execute the withdrawal
      const result = await this.executeWithdrawal(
        walletChain,
        chain,
        asset,
        amount,
        destinationAddress
      );

      if (result.success) {
        // Update payout request with success
        await this.prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: {
            status: 'fulfilled',
            txHash: result.txHash,
            blockNumber: result.blockNumber ? BigInt(result.blockNumber) : null,
            gasUsed: result.gasUsed,
          },
        });

        // Emit success event
        await this.walletEventProducer.withdrawalCompleted(
          payoutRequest.id,
          senderId,
          walletChain,
          asset,
          amount,
          destinationAddress,
          result.txHash!,
          result.blockNumber!,
          result.gasUsed || '0',
          metadata.correlationId
        );

        this.logger.log(
          `Withdrawal ${payoutRequest.id} completed: ${result.txHash}`
        );
      } else {
        // Create payout attempt record
        await this.prisma.payoutAttempt.create({
          data: {
            payoutRequestId: payoutRequest.id,
            attemptNumber: 1,
            errorMessage: result.error,
          },
        });

        // Update payout request status
        await this.prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: { status: 'pending' }, // Keep pending for retry
        });

        // Emit failure event
        await this.walletEventProducer.withdrawalFailed(
          payoutRequest.id,
          senderId,
          walletChain,
          asset,
          amount,
          destinationAddress,
          result.error || 'Unknown error',
          1,
          metadata.correlationId
        );

        this.logger.warn(
          `Withdrawal ${payoutRequest.id} failed: ${result.error}`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process withdrawal ${transferId}: ${error.message}`
      );
      throw error; // Re-throw to trigger Kafka retry
    }
  }

  /**
   * Execute withdrawal based on chain type
   */
  private async executeWithdrawal(
    walletChain: WalletChainId,
    listenerChain: string,
    asset: string,
    amount: string,
    destinationAddress: string
  ): Promise<TransactionResult> {
    switch (walletChain) {
      case 'evm':
        return this.executeEvmWithdrawal(
          listenerChain,
          asset,
          amount,
          destinationAddress
        );
      case 'sol':
        return this.executeSolanaWithdrawal(asset, amount, destinationAddress);
      case 'trc':
        return this.executeTronWithdrawal(asset, amount, destinationAddress);
      default:
        return { success: false, error: `Unsupported chain: ${walletChain}` };
    }
  }

  /**
   * Execute EVM withdrawal
   */
  private async executeEvmWithdrawal(
    network: string,
    asset: string,
    amount: string,
    destinationAddress: string
  ): Promise<TransactionResult> {
    // Find token config
    const tokenConfig = EVM_TOKENS.find((t) => t.symbol === asset);
    if (!tokenConfig) {
      return { success: false, error: `Unsupported EVM asset: ${asset}` };
    }

    // Map network to executor network type
    const evmNetwork = network as 'eth' | 'bnb' | 'poly';

    // Get hot wallet address
    const hotWalletAddress = await this.platformKeyService.getHotWalletAddress('evm');

    // Check if hot wallet has sufficient gas
    const needsFunding = await this.evmExecutor.needsGasFunding(
      evmNetwork,
      hotWalletAddress
    );

    if (needsFunding) {
      this.logger.log(
        `Hot wallet ${hotWalletAddress} needs gas funding on ${evmNetwork}. Funding now...`
      );

      // Fund the hot wallet
      const fundResult = await this.evmExecutor.fundWalletWithGas(
        evmNetwork,
        hotWalletAddress
      );

      if (!fundResult.success) {
        return {
          success: false,
          error: `Failed to fund hot wallet with gas: ${fundResult.error}`,
        };
      }

      this.logger.log(
        `Hot wallet funded successfully: ${fundResult.txHash}. Waiting for confirmation...`
      );

      // Wait for funding transaction to be confirmed before proceeding
      // This ensures the hot wallet has gas available for the withdrawal
      const confirmed = await this.evmExecutor.waitForConfirmation(
        evmNetwork,
        fundResult.txHash!,
        60 // Max 60 seconds wait
      );

      if (!confirmed) {
        return {
          success: false,
          error: `Funding transaction ${fundResult.txHash} not confirmed within timeout`,
        };
      }

      this.logger.log(`Funding transaction ${fundResult.txHash} confirmed`);
    }

    // Execute the withdrawal
    return this.evmExecutor.executeWithdrawal(
      evmNetwork,
      tokenConfig.address,
      destinationAddress,
      amount,
      tokenConfig.decimals
    );
  }

  /**
   * Execute Solana withdrawal
   */
  private async executeSolanaWithdrawal(
    asset: string,
    amount: string,
    destinationAddress: string
  ): Promise<TransactionResult> {
    // Find token config
    const tokenConfig = SOL_TOKENS.find((t) => t.symbol === asset);
    if (!tokenConfig) {
      return { success: false, error: `Unsupported Solana asset: ${asset}` };
    }

    // Get hot wallet address
    const hotWalletAddress = await this.platformKeyService.getHotWalletAddress('sol');

    // Check if hot wallet has sufficient SOL for fees
    const needsFunding =
      await this.solanaExecutor.needsFunding(hotWalletAddress);

    if (needsFunding) {
      this.logger.log(
        `Hot wallet ${hotWalletAddress} needs SOL funding. Funding now...`
      );

      // Fund the hot wallet
      const fundResult =
        await this.solanaExecutor.fundWalletWithSol(hotWalletAddress);

      if (!fundResult.success) {
        return {
          success: false,
          error: `Failed to fund hot wallet with SOL: ${fundResult.error}`,
        };
      }

      this.logger.log(
        `Hot wallet funded successfully: ${fundResult.txHash}. Waiting for confirmation...`
      );

      // Wait for funding transaction to be confirmed
      const confirmed = await this.solanaExecutor.waitForConfirmation(
        fundResult.txHash!,
        30 // Max 30 seconds wait (Solana is faster)
      );

      if (!confirmed) {
        return {
          success: false,
          error: `Funding transaction ${fundResult.txHash} not confirmed within timeout`,
        };
      }

      this.logger.log(`Funding transaction ${fundResult.txHash} confirmed`);
    }

    // Execute the withdrawal
    return this.solanaExecutor.executeWithdrawal(
      tokenConfig.address,
      destinationAddress,
      amount,
      tokenConfig.decimals
    );
  }

  /**
   * Execute Tron withdrawal
   */
  private async executeTronWithdrawal(
    asset: string,
    amount: string,
    destinationAddress: string
  ): Promise<TransactionResult> {
    // Find token config
    const tokenConfig = TRC_TOKENS.find((t) => t.symbol === asset);
    if (!tokenConfig) {
      return { success: false, error: `Unsupported Tron asset: ${asset}` };
    }

    // Get hot wallet address
    const hotWalletAddress = await this.platformKeyService.getHotWalletAddress('trc');

    // Check if hot wallet has sufficient TRX for energy/bandwidth
    const needsFunding = await this.tronExecutor.needsFunding(hotWalletAddress);

    if (needsFunding) {
      this.logger.log(
        `Hot wallet ${hotWalletAddress} needs TRX funding. Funding now...`
      );

      // Fund the hot wallet
      const fundResult =
        await this.tronExecutor.fundWalletWithTrx(hotWalletAddress);

      if (!fundResult.success) {
        return {
          success: false,
          error: `Failed to fund hot wallet with TRX: ${fundResult.error}`,
        };
      }

      this.logger.log(
        `Hot wallet funded successfully: ${fundResult.txHash}. Waiting for confirmation...`
      );

      // Wait for funding transaction to be confirmed
      const confirmed = await this.tronExecutor.waitForConfirmation(
        fundResult.txHash!,
        30 // Max 30 seconds wait (Tron is fast)
      );

      if (!confirmed) {
        return {
          success: false,
          error: `Funding transaction ${fundResult.txHash} not confirmed within timeout`,
        };
      }

      this.logger.log(`Funding transaction ${fundResult.txHash} confirmed`);
    }

    // Execute the withdrawal
    return this.tronExecutor.executeWithdrawal(
      tokenConfig.address,
      destinationAddress,
      amount,
      tokenConfig.decimals
    );
  }
}
