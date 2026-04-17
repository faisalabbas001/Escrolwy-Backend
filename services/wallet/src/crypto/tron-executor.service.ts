import { Injectable, Logger } from '@nestjs/common';
import { WalletConfigService } from '../config';
import { WalletGeneratorService } from './wallet-generator.service';
import { PlatformKeyService } from './platform-key.service';

// Import TronWeb as CommonJS module
const TronWeb = require('tronweb');

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
 * Tron Executor Service
 *
 * Handles Tron chain transactions:
 * - TRC20 token transfers
 * - TRX transfers (for energy/bandwidth)
 * - Balance checks
 */
@Injectable()
export class TronExecutorService {
  private readonly logger = new Logger(TronExecutorService.name);
  private tronWeb: InstanceType<typeof TronWeb> | null = null;

  constructor(
    private readonly walletConfig: WalletConfigService,
    private readonly walletGenerator: WalletGeneratorService,
    private readonly platformKeyService: PlatformKeyService,
  ) {}

  /**
   * Get or create TronWeb instance
   */
  private getTronWeb(privateKey?: string): InstanceType<typeof TronWeb> {
    const rpcUrl = this.walletConfig.getRpcUrl('trc');

    const config: any = {
      fullHost: rpcUrl,
    };

    // Add API key header if using TronGrid
    if (rpcUrl.includes('trongrid.io')) {
      config.headers = { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY || '' };
    }

    if (privateKey) {
      config.privateKey = privateKey;
    }

    return new TronWeb(config);
  }

  /**
   * Transfer TRC20 tokens
   */
  async transferToken(
    tokenAddress: string,
    fromEncryptedKey: string,
    toAddress: string,
    amount: string,
    decimals: number,
  ): Promise<TransactionResult> {
    try {
      const privateKey = await this.walletGenerator.recoverTronPrivateKey(fromEncryptedKey);
      const tronWeb = this.getTronWeb(privateKey);

      // Get contract instance
      const contract = await tronWeb.contract().at(tokenAddress);

      // Calculate amount - if it contains decimal point, convert from human-readable format,
      // otherwise it's already in smallest unit (from deposit transaction)
      const amountSun = amount.includes('.')
        ? BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)))
        : BigInt(amount);

      // Execute transfer
      const result = await contract.transfer(toAddress, amountSun.toString()).send({
        feeLimit: 100_000_000, // 100 TRX fee limit
      });

      this.logger.log(`Tron token transfer initiated: ${result}`);

      // Wait for confirmation (Tron transactions are usually fast)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get transaction info
      const txInfo = await tronWeb.trx.getTransactionInfo(result);

      return {
        success: true,
        txHash: result,
        blockNumber: txInfo.blockNumber,
        gasUsed: txInfo.fee?.toString(),
      };
    } catch (error: any) {
      this.logger.error(`Tron token transfer failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transfer TRX for energy/bandwidth
   */
  async transferTrx(
    fromEncryptedKey: string,
    toAddress: string,
    amount: string,
  ): Promise<TransactionResult> {
    try {
      const privateKey = await this.walletGenerator.recoverTronPrivateKey(fromEncryptedKey);
      const tronWeb = this.getTronWeb(privateKey);

      // Convert amount to SUN (1 TRX = 1,000,000 SUN)
      const amountSun = Math.floor(parseFloat(amount) * 1_000_000);

      // Execute transfer
      const result = await tronWeb.trx.sendTransaction(toAddress, amountSun);

      if (!result.result) {
        throw new Error(result.code || 'Transfer failed');
      }

      this.logger.log(`Tron TRX transfer completed: ${result.txid}`);

      // Wait for confirmation
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get transaction info
      const txInfo = await tronWeb.trx.getTransactionInfo(result.txid);

      return {
        success: true,
        txHash: result.txid,
        blockNumber: txInfo.blockNumber,
        gasUsed: txInfo.fee?.toString(),
      };
    } catch (error: any) {
      this.logger.error(`Tron TRX transfer failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get TRC20 token balance
   */
  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string,
  ): Promise<{ balance: string; decimals: number }> {
    try {
      const tronWeb = this.getTronWeb();

      // Set default address for contract calls (required by TronWeb)
      tronWeb.setAddress(walletAddress);

      this.logger.debug(`Getting balance for ${walletAddress} on token ${tokenAddress}`);

      // Get contract instance
      const contract = await tronWeb.contract().at(tokenAddress);

      // Get balance and decimals
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(walletAddress).call(),
        contract.decimals().call(),
      ]);

      const balanceNum = Number(balance) / Math.pow(10, Number(decimals));

      this.logger.debug(`Token balance: ${balanceNum} (raw: ${balance}, decimals: ${decimals})`);

      return {
        balance: balanceNum.toString(),
        decimals: Number(decimals),
      };
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      this.logger.error(`Failed to get Tron token balance: ${errorMsg}`);
      if (error?.stack) {
        this.logger.debug(`Stack: ${error.stack}`);
      }
      return {
        balance: '0',
        decimals: 6,
      };
    }
  }

  /**
   * Get TRX balance
   */
  async getTrxBalance(walletAddress: string): Promise<string> {
    try {
      const tronWeb = this.getTronWeb();
      const balance = await tronWeb.trx.getBalance(walletAddress);
      return (balance / 1_000_000).toString();
    } catch (error: any) {
      this.logger.error(`Failed to get TRX balance: ${error.message}`);
      return '0';
    }
  }

  /**
   * Check if wallet needs TRX funding
   */
  async needsFunding(walletAddress: string): Promise<boolean> {
    const balance = await this.getTrxBalance(walletAddress);
    const threshold = this.walletConfig.getFundingThreshold('trc');
    return parseFloat(balance) < parseFloat(threshold);
  }

  /**
   * Fund wallet with TRX from funding wallet
   */
  async fundWalletWithTrx(toAddress: string): Promise<TransactionResult> {
    // Get encrypted key - transferTrx will decrypt it
    const fundingKey = await this.platformKeyService.getFundingWalletEncryptedKey('trc');
    const fundingAmount = this.walletConfig.getFundingAmount('trc');

    return this.transferTrx(fundingKey, toAddress, fundingAmount);
  }

  /**
   * Execute withdrawal from hot wallet to external address
   */
  async executeWithdrawal(
    tokenAddress: string,
    toAddress: string,
    amount: string,
    decimals: number,
  ): Promise<TransactionResult> {
    // Get encrypted key - transferToken will decrypt it
    const hotWalletKey = await this.platformKeyService.getFundingWalletEncryptedKey('trc');

    return this.transferToken(tokenAddress, hotWalletKey, toAddress, amount, decimals);
  }

  /**
   * Wait for transaction confirmation by polling
   */
  async waitForConfirmation(
    txHash: string,
    maxWaitSeconds: number = 30,
  ): Promise<boolean> {
    const tronWeb = this.getTronWeb();
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const txInfo = await tronWeb.trx.getTransactionInfo(txHash);
        if (txInfo && txInfo.blockNumber) {
          this.logger.debug(`Transaction ${txHash} confirmed at block ${txInfo.blockNumber}`);
          return true;
        }
      } catch (error: any) {
        // Transaction not yet confirmed, continue polling
        if (!error.message?.includes('not found')) {
          this.logger.debug(`Polling transaction ${txHash}: ${error.message}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    this.logger.warn(`Transaction ${txHash} confirmation timeout after ${maxWaitSeconds}s`);
    return false;
  }
}

