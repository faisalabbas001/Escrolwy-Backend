import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
  WalletChainId,
  EVM_TOKENS,
  SOL_TOKENS,
  TRC_TOKENS,
  WalletConfigService,
} from '../config';

/**
 * Withdrawal Retry Cron
 *
 * Periodically retries failed or pending withdrawals.
 *
 * Schedule: Every 30 seconds (configurable via WITHDRAWAL_RETRY_CRON)
 *
 * Flow:
 * 1. Query payout_requests WHERE status = 'pending'
 * 2. For each: attempt transaction execution
 * 3. Update status on success/failure
 * 4. Create payout_attempt on failure
 * 5. Mark as 'failed' after max retries
 */
@Injectable()
export class WithdrawalRetryCron {
  private readonly logger = new Logger(WithdrawalRetryCron.name);
  private readonly maxRetries = 5;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEventProducer: WalletEventProducer,
    private readonly evmExecutor: EvmExecutorService,
    private readonly solanaExecutor: SolanaExecutorService,
    private readonly tronExecutor: TronExecutorService,
    private readonly walletConfig: WalletConfigService,
    private readonly platformKeyService: PlatformKeyService,
  ) {}

  /**
   * Retry pending withdrawals every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleWithdrawalRetry() {
    // Prevent concurrent execution
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Find pending payout requests
      const pendingPayouts = await this.prisma.payoutRequest.findMany({
        where: {
          status: 'pending',
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 10, // Process 10 at a time
      });

      if (pendingPayouts.length === 0) {
        return;
      }

      this.logger.log(`Processing ${pendingPayouts.length} pending withdrawals`);

      for (const payout of pendingPayouts) {
        await this.retryPayout(payout);
      }
    } catch (error: any) {
      this.logger.error(`Withdrawal retry cron error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a single payout
   */
  private async retryPayout(payout: {
    id: string;
    userId: string;
    chain: string;
    asset: string;
    amount: any;
    destinationAddress: string;
  }): Promise<void> {
    try {
      // Count existing attempts
      const attemptCount = await this.prisma.payoutAttempt.count({
        where: { payoutRequestId: payout.id },
      });

      if (attemptCount >= this.maxRetries) {
        // Max retries exceeded - mark as permanently failed
        await this.prisma.payoutRequest.update({
          where: { id: payout.id },
          data: { status: 'failed' },
        });

        // Get last attempt's error message
        const lastAttempt = await this.prisma.payoutAttempt.findFirst({
          where: { payoutRequestId: payout.id },
          orderBy: { attemptNumber: 'desc' },
        });

        // Emit permanently failed event
        await this.walletEventProducer.payoutPermanentlyFailed(
          payout.id,
          payout.userId,
          payout.chain,
          payout.asset,
          payout.amount.toString(),
          payout.destinationAddress,
          attemptCount,
          lastAttempt?.errorMessage || 'Max retries exceeded',
        );

        this.logger.warn(`Payout ${payout.id} exceeded max retries, marked as failed`);
        return;
      }

      const nextAttempt = attemptCount + 1;
      this.logger.log(`Retrying payout ${payout.id} (attempt ${nextAttempt})`);

      // Execute withdrawal
      const result = await this.executeWithdrawal(
        payout.chain as WalletChainId,
        payout.asset,
        payout.amount.toString(),
        payout.destinationAddress,
      );

      if (result.success) {
        // Update payout request with success
        await this.prisma.payoutRequest.update({
          where: { id: payout.id },
          data: {
            status: 'fulfilled',
            txHash: result.txHash,
            blockNumber: result.blockNumber ? BigInt(result.blockNumber) : null,
            gasUsed: result.gasUsed,
          },
        });

        // Emit success event
        await this.walletEventProducer.withdrawalCompleted(
          payout.id,
          payout.userId,
          payout.chain,
          payout.asset,
          payout.amount.toString(),
          payout.destinationAddress,
          result.txHash!,
          result.blockNumber!,
          result.gasUsed || '0',
        );

        this.logger.log(`Payout ${payout.id} completed on retry: ${result.txHash}`);
      } else {
        // Create payout attempt record
        await this.prisma.payoutAttempt.create({
          data: {
            payoutRequestId: payout.id,
            attemptNumber: nextAttempt,
            errorMessage: result.error,
          },
        });

        // Emit failure event
        await this.walletEventProducer.withdrawalFailed(
          payout.id,
          payout.userId,
          payout.chain,
          payout.asset,
          payout.amount.toString(),
          payout.destinationAddress,
          result.error || 'Unknown error',
          nextAttempt,
        );

        this.logger.warn(`Payout ${payout.id} retry failed: ${result.error}`);
      }
    } catch (error: any) {
      this.logger.error(`Error retrying payout ${payout.id}: ${error.message}`);
    }
  }

  /**
   * Execute withdrawal based on chain type
   */
  private async executeWithdrawal(
    chain: WalletChainId,
    asset: string,
    amount: string,
    destinationAddress: string,
  ): Promise<TransactionResult> {
    switch (chain) {
      case 'evm':
        return this.executeEvmWithdrawal(asset, amount, destinationAddress);
      case 'sol':
        return this.executeSolanaWithdrawal(asset, amount, destinationAddress);
      case 'trc':
        return this.executeTronWithdrawal(asset, amount, destinationAddress);
      default:
        return { success: false, error: `Unsupported chain: ${chain}` };
    }
  }

  private async executeEvmWithdrawal(
    asset: string,
    amount: string,
    destinationAddress: string,
  ): Promise<TransactionResult> {
    const tokenConfig = EVM_TOKENS.find((t) => t.symbol === asset);
    if (!tokenConfig) {
      return { success: false, error: `Unsupported EVM asset: ${asset}` };
    }

    // Default to ETH network for retries (could be improved to detect original network)
    const evmNetwork: 'eth' | 'bnb' | 'poly' = 'eth';

    // Get hot wallet address
    const hotWalletAddress = await this.platformKeyService.getHotWalletAddress('evm');

    // Check if hot wallet has sufficient gas
    const needsFunding = await this.evmExecutor.needsGasFunding(
      evmNetwork,
      hotWalletAddress,
    );

    if (needsFunding) {
      this.logger.log(
        `Hot wallet ${hotWalletAddress} needs gas funding on ${evmNetwork} for retry. Funding now...`,
      );

      // Fund the hot wallet
      const fundResult = await this.evmExecutor.fundWalletWithGas(
        evmNetwork,
        hotWalletAddress,
      );

      if (!fundResult.success) {
        return {
          success: false,
          error: `Failed to fund hot wallet with gas: ${fundResult.error}`,
        };
      }

      this.logger.log(
        `Hot wallet funded successfully: ${fundResult.txHash}. Waiting for confirmation...`,
      );

      // Wait for funding transaction to be confirmed before proceeding
      const confirmed = await this.evmExecutor.waitForConfirmation(
        evmNetwork,
        fundResult.txHash!,
        60, // Max 60 seconds wait
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
      tokenConfig.decimals,
    );
  }

  private async executeSolanaWithdrawal(
    asset: string,
    amount: string,
    destinationAddress: string,
  ): Promise<TransactionResult> {
    const tokenConfig = SOL_TOKENS.find((t) => t.symbol === asset);
    if (!tokenConfig) {
      return { success: false, error: `Unsupported Solana asset: ${asset}` };
    }

    // Get hot wallet address
    const hotWalletAddress = await this.platformKeyService.getHotWalletAddress('sol');

    // Check if hot wallet has sufficient SOL for fees
    const needsFunding = await this.solanaExecutor.needsFunding(hotWalletAddress);

    if (needsFunding) {
      this.logger.log(
        `Hot wallet ${hotWalletAddress} needs SOL funding for retry. Funding now...`,
      );

      // Fund the hot wallet
      const fundResult = await this.solanaExecutor.fundWalletWithSol(hotWalletAddress);

      if (!fundResult.success) {
        return {
          success: false,
          error: `Failed to fund hot wallet with SOL: ${fundResult.error}`,
        };
      }

      this.logger.log(
        `Hot wallet funded successfully: ${fundResult.txHash}. Waiting for confirmation...`,
      );

      // Wait for funding transaction to be confirmed
      const confirmed = await this.solanaExecutor.waitForConfirmation(
        fundResult.txHash!,
        30, // Max 30 seconds wait
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
      tokenConfig.decimals,
    );
  }

  private async executeTronWithdrawal(
    asset: string,
    amount: string,
    destinationAddress: string,
  ): Promise<TransactionResult> {
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
        `Hot wallet ${hotWalletAddress} needs TRX funding for retry. Funding now...`,
      );

      // Fund the hot wallet
      const fundResult = await this.tronExecutor.fundWalletWithTrx(hotWalletAddress);

      if (!fundResult.success) {
        return {
          success: false,
          error: `Failed to fund hot wallet with TRX: ${fundResult.error}`,
        };
      }

      this.logger.log(
        `Hot wallet funded successfully: ${fundResult.txHash}. Waiting for confirmation...`,
      );

      // Wait for funding transaction to be confirmed
      const confirmed = await this.tronExecutor.waitForConfirmation(
        fundResult.txHash!,
        30, // Max 30 seconds wait
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
      tokenConfig.decimals,
    );
  }
}

