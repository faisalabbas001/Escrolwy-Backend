import { Injectable, Logger } from '@nestjs/common';
import { WalletConfigService, type WalletChainId, getTokenConfig } from '../config';
import {
  EvmExecutorService,
  SolanaExecutorService,
  TronExecutorService,
  PlatformKeyService,
} from '../crypto';
import { WalletEventProducer } from '../kafka';

/**
 * Hot-to-Cold Transfer Result
 */
export interface HotToColdResult {
  transferred: boolean;
  amount?: string;
  txHash?: string;
  error?: string;
}

/**
 * Hot-to-Cold Transfer Service
 *
 * Automatically transfers excess tokens from hot wallet to cold wallet
 * when balance exceeds configured thresholds.
 *
 * Flow:
 * 1. Get hot wallet token balance
 * 2. Compare against threshold (e.g., 2500 USDT)
 * 3. If exceeded, calculate transfer amount (balance * percent / 100)
 * 4. Execute transfer to cold wallet
 */
@Injectable()
export class HotToColdService {
  private readonly logger = new Logger(HotToColdService.name);

  constructor(
    private readonly walletConfig: WalletConfigService,
    private readonly evmExecutor: EvmExecutorService,
    private readonly solanaExecutor: SolanaExecutorService,
    private readonly tronExecutor: TronExecutorService,
    private readonly platformKeyService: PlatformKeyService,
    private readonly walletEventProducer: WalletEventProducer,
  ) {}

  /**
   * Check hot wallet balance and transfer to cold wallet if threshold exceeded
   */
  async checkAndTransfer(
    chain: WalletChainId,
    token: string,
    tokenAddress: string,
    decimals: number,
  ): Promise<HotToColdResult> {
    // Check if hot-to-cold is enabled
    if (!this.walletConfig.isHotToColdEnabled()) {
      return { transferred: false };
    }

    try {
      const hotWallet = await this.platformKeyService.getHotWalletAddress(chain);
      const coldWallet = await this.platformKeyService.getColdWalletAddress(chain);
      const threshold = parseFloat(this.walletConfig.getHotToColdThreshold(token));
      const transferPercent = this.walletConfig.getHotToColdTransferPercent();

      // Get hot wallet balance
      const balance = await this.getHotWalletBalance(chain, tokenAddress, hotWallet);
      const balanceNum = parseFloat(balance);

      this.logger.debug(
        `Hot wallet ${token} balance: ${balanceNum}, threshold: ${threshold}`,
      );

      // Check if threshold exceeded
      if (balanceNum <= threshold) {
        return { transferred: false };
      }

      // Calculate transfer amount (percentage of current balance)
      const transferAmount = (balanceNum * transferPercent) / 100;
      const transferAmountSmallestUnit = Math.floor(
        transferAmount * Math.pow(10, decimals),
      ).toString();

      this.logger.log(
        `Hot wallet ${token} balance (${balanceNum}) exceeds threshold (${threshold}). ` +
          `Transferring ${transferPercent}% (${transferAmount} ${token}) to cold wallet.`,
      );

      // Execute transfer from hot wallet to cold wallet
      const result = await this.transferToColdWallet(
        chain,
        tokenAddress,
        coldWallet,
        transferAmountSmallestUnit,
        decimals,
      );

      if (result.success) {
        this.logger.log(
          `Hot-to-cold transfer complete: ${transferAmount} ${token} -> ${coldWallet.slice(0, 10)}... (tx: ${result.txHash})`,
        );

        // Emit hot-to-cold completed event
        await this.walletEventProducer.hotToColdCompleted(
          chain,
          token,
          transferAmount.toString(),
          hotWallet,
          coldWallet,
          result.txHash!,
        );

        return {
          transferred: true,
          amount: transferAmount.toString(),
          txHash: result.txHash,
        };
      } else {
        this.logger.error(`Hot-to-cold transfer failed: ${result.error}`);

        // Emit hot-to-cold failed event
        await this.walletEventProducer.hotToColdFailed(
          chain,
          token,
          transferAmount.toString(),
          hotWallet,
          coldWallet,
          result.error || 'Unknown error',
        );

        return {
          transferred: false,
          error: result.error,
        };
      }
    } catch (error: any) {
      // Don't throw - cold wallet might not be configured yet
      if (error.message?.includes('not configured')) {
        this.logger.debug(`Hot-to-cold skipped: ${error.message}`);
        return { transferred: false };
      }
      this.logger.error(`Hot-to-cold check error: ${error.message}`);
      return { transferred: false, error: error.message };
    }
  }

  /**
   * Get hot wallet token balance
   */
  private async getHotWalletBalance(
    chain: WalletChainId,
    tokenAddress: string,
    hotWallet: string,
  ): Promise<string> {
    switch (chain) {
      case 'evm':
        // Use ETH network as default for EVM balance check
        const evmResult = await this.evmExecutor.getTokenBalance(
          'eth',
          tokenAddress,
          hotWallet,
        );
        return evmResult.balance;

      case 'sol':
        const solResult = await this.solanaExecutor.getTokenBalance(
          tokenAddress,
          hotWallet,
        );
        return solResult.balance;

      case 'trc':
        const trcResult = await this.tronExecutor.getTokenBalance(
          tokenAddress,
          hotWallet,
        );
        return trcResult.balance;

      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  /**
   * Transfer tokens from hot wallet to cold wallet
   */
  private async transferToColdWallet(
    chain: WalletChainId,
    tokenAddress: string,
    coldWallet: string,
    amount: string,
    decimals: number,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Get encrypted key - executor services will decrypt it
    const hotWalletKey = await this.platformKeyService.getHotWalletEncryptedKey(chain);

    switch (chain) {
      case 'evm':
        return this.evmExecutor.transferToken(
          'eth', // Use ETH network
          tokenAddress,
          hotWalletKey,
          coldWallet,
          amount,
          decimals,
        );

      case 'sol':
        return this.solanaExecutor.transferToken(
          tokenAddress,
          hotWalletKey,
          coldWallet,
          amount,
          decimals,
        );

      case 'trc':
        return this.tronExecutor.transferToken(
          tokenAddress,
          hotWalletKey,
          coldWallet,
          amount,
          decimals,
        );

      default:
        return { success: false, error: `Unsupported chain: ${chain}` };
    }
  }
}
