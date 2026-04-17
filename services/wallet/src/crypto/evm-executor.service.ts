import { Injectable, Logger } from '@nestjs/common';
import {
  ethers,
  JsonRpcProvider,
  Contract,
  Wallet,
  parseUnits,
  formatUnits,
} from 'ethers';
import { ERC20_ABI } from '@escrowly/chain-config';
import { WalletConfigService, WalletChainId } from '../config';
import { WalletGeneratorService } from './wallet-generator.service';
import { PlatformKeyService } from './platform-key.service';

/**
 * Transaction Result
 */
export interface TransactionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

/**
 * EVM Executor Service
 *
 * Handles EVM chain transactions:
 * - Token transfers
 * - Native token transfers (for gas funding)
 * - Balance checks
 */
@Injectable()
export class EvmExecutorService {
  private readonly logger = new Logger(EvmExecutorService.name);
  private providers: Map<string, JsonRpcProvider> = new Map();

  constructor(
    private readonly walletConfig: WalletConfigService,
    private readonly walletGenerator: WalletGeneratorService,
    private readonly platformKeyService: PlatformKeyService,
  ) {}

  /**
   * Get or create provider for a network
   */
  private getProvider(network: 'eth' | 'bnb' | 'poly'): JsonRpcProvider {
    if (!this.providers.has(network)) {
      const rpcUrl = this.walletConfig.getEvmRpcUrl(network);
      this.providers.set(network, new JsonRpcProvider(rpcUrl));
    }
    return this.providers.get(network)!;
  }

  /**
   * Transfer ERC20 tokens
   */
  async transferToken(
    network: 'eth' | 'bnb' | 'poly',
    tokenAddress: string,
    fromEncryptedKey: string,
    toAddress: string,
    amount: string,
    decimals: number
  ): Promise<TransactionResult> {
    try {
      const provider = this.getProvider(network);
      const wallet =
        await this.walletGenerator.recoverEvmWallet(fromEncryptedKey);
      const signer = wallet.connect(provider);

      const contract = new Contract(tokenAddress, ERC20_ABI, signer);

      // Parse amount - if it contains decimal point, use parseUnits (human-readable format),
      // otherwise it's already in smallest unit (from deposit transaction)
      const amountWei = amount.includes('.')
        ? parseUnits(amount, decimals)
        : BigInt(amount);

      // Get gas price with multiplier
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice
        ? (feeData.gasPrice *
            BigInt(
              Math.floor(this.walletConfig.getGasMultiplier('evm') * 100)
            )) /
          BigInt(100)
        : undefined;

      // Execute transfer
      const tx = await contract.transfer(toAddress, amountWei, {
        gasPrice,
      });

      this.logger.log(`EVM token transfer initiated: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      this.logger.error(`EVM token transfer failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transfer native token (ETH/BNB/MATIC) for gas funding
   */
  async transferNative(
    network: 'eth' | 'bnb' | 'poly',
    fromEncryptedKey: string,
    toAddress: string,
    amount: string
  ): Promise<TransactionResult> {
    try {
      const provider = this.getProvider(network);
      const wallet =
        await this.walletGenerator.recoverEvmWallet(fromEncryptedKey);
      const signer = wallet.connect(provider);

      // Parse amount (native tokens use 18 decimals)
      const amountWei = parseUnits(amount, 18);

      // Get gas price with multiplier
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice
        ? (feeData.gasPrice *
            BigInt(
              Math.floor(this.walletConfig.getGasMultiplier('evm') * 100)
            )) /
          BigInt(100)
        : undefined;

      // Execute transfer
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: amountWei,
        gasPrice,
      });

      this.logger.log(`EVM native transfer initiated: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt!.hash,
        blockNumber: receipt!.blockNumber,
        gasUsed: receipt!.gasUsed.toString(),
      };
    } catch (error: any) {
      this.logger.error(`EVM native transfer failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(
    network: 'eth' | 'bnb' | 'poly',
    tokenAddress: string,
    walletAddress: string
  ): Promise<{ balance: string; decimals: number }> {
    const provider = this.getProvider(network);
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);

    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
    ]);

    return {
      balance: formatUnits(balance, decimals),
      decimals,
    };
  }

  /**
   * Get native token balance
   */
  async getNativeBalance(
    network: 'eth' | 'bnb' | 'poly',
    walletAddress: string
  ): Promise<string> {
    const provider = this.getProvider(network);
    const balance = await provider.getBalance(walletAddress);
    return formatUnits(balance, 18);
  }

  /**
   * Check if wallet needs gas funding
   */
  async needsGasFunding(
    network: 'eth' | 'bnb' | 'poly',
    walletAddress: string
  ): Promise<boolean> {
    const balance = await this.getNativeBalance(network, walletAddress);
    const threshold = this.walletConfig.getFundingThreshold('evm');
    return parseFloat(balance) < parseFloat(threshold);
  }

  /**
   * Fund wallet with gas from funding wallet
   */
  async fundWalletWithGas(
    network: 'eth' | 'bnb' | 'poly',
    toAddress: string
  ): Promise<TransactionResult> {
    // Get encrypted key - transferNative will decrypt it
    const fundingKey = await this.platformKeyService.getFundingWalletEncryptedKey('evm');
    const fundingAmount = this.walletConfig.getFundingAmount('evm');

    return this.transferNative(network, fundingKey, toAddress, fundingAmount);
  }

  /**
   * Wait for transaction confirmation by polling receipt
   */
  async waitForConfirmation(
    network: 'eth' | 'bnb' | 'poly',
    txHash: string,
    maxWaitSeconds: number = 60
  ): Promise<boolean> {
    const provider = this.getProvider(network);
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt && receipt.status === 1) {
          this.logger.debug(
            `Transaction ${txHash} confirmed at block ${receipt.blockNumber}`
          );
          return true;
        }
        if (receipt && receipt.status === 0) {
          this.logger.error(`Transaction ${txHash} failed`);
          return false;
        }
      } catch (error) {
        // Transaction not yet mined, continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    this.logger.warn(
      `Transaction ${txHash} confirmation timeout after ${maxWaitSeconds}s`
    );
    return false;
  }

  /**
   * Execute withdrawal from hot wallet to external address
   */
  async executeWithdrawal(
    network: 'eth' | 'bnb' | 'poly',
    tokenAddress: string,
    toAddress: string,
    amount: string,
    decimals: number
  ): Promise<TransactionResult> {
    // Get encrypted key - transferToken will decrypt it
    const hotWalletKey = await this.platformKeyService.getFundingWalletEncryptedKey('evm');

    return this.transferToken(
      network,
      tokenAddress,
      hotWalletKey,
      toAddress,
      amount,
      decimals
    );
  }
}
