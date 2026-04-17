import { Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { WalletConfigService } from '../config';
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
 * Solana Executor Service
 *
 * Handles Solana chain transactions:
 * - SPL token transfers
 * - SOL transfers (for rent/fees)
 * - Balance checks
 */
@Injectable()
export class SolanaExecutorService {
  private readonly logger = new Logger(SolanaExecutorService.name);
  private connection: Connection | null = null;

  constructor(
    private readonly walletConfig: WalletConfigService,
    private readonly walletGenerator: WalletGeneratorService,
    private readonly platformKeyService: PlatformKeyService
  ) {}

  /**
   * Get or create Solana connection
   */
  private getConnection(): Connection {
    if (!this.connection) {
      const rpcUrl = this.walletConfig.getRpcUrl('sol');
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
    return this.connection;
  }

  /**
   * Transfer SPL tokens
   */
  async transferToken(
    tokenMint: string,
    fromEncryptedKey: string,
    toAddress: string,
    amount: string | number,
    decimals: number
  ): Promise<TransactionResult> {
    try {
      const connection = this.getConnection();
      const keypair =
        await this.walletGenerator.recoverSolanaKeypair(fromEncryptedKey);

      const mintPubkey = new PublicKey(tokenMint);
      const toPubkey = new PublicKey(toAddress);

      // Get associated token accounts
      const fromTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        keypair.publicKey
      );
      const toTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        toPubkey
      );

      // Calculate amount - if it contains decimal point, convert from human-readable format,
      // otherwise it's already in smallest unit (from deposit transaction)
      // Ensure amount is a string (payload might send it as number)
      const amountStr = typeof amount === 'string' ? amount : amount.toString();
      const amountLamports = amountStr.includes('.')
        ? BigInt(Math.floor(parseFloat(amountStr) * Math.pow(10, decimals)))
        : BigInt(amountStr);

      // Create transaction
      const transaction = new Transaction();

      // Check if destination ATA exists, if not create it
      try {
        await getAccount(connection, toTokenAccount);
      } catch (e: any) {
        // Account doesn't exist, need to create it
        if (e.name === 'TokenAccountNotFoundError') {
          this.logger.debug(
            `Creating ATA for ${toAddress} for token ${tokenMint}`
          );
          transaction.add(
            createAssociatedTokenAccountInstruction(
              keypair.publicKey, // payer
              toTokenAccount, // ata
              toPubkey, // owner
              mintPubkey, // mint
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        } else {
          throw e;
        }
      }

      // Add transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        keypair.publicKey,
        amountLamports,
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(transferInstruction);

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );

      this.logger.log(`Solana token transfer completed: ${signature}`);

      // Get transaction details
      const txDetails = await connection.getTransaction(signature);

      return {
        success: true,
        txHash: signature,
        blockNumber: txDetails?.slot,
        gasUsed: txDetails?.meta?.fee?.toString(),
      };
    } catch (error: any) {
      this.logger.error(`Solana token transfer failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transfer SOL for rent/fees
   */
  async transferSol(
    fromEncryptedKey: string,
    toAddress: string,
    amount: string | number
  ): Promise<TransactionResult> {
    try {
      const connection = this.getConnection();
      const keypair =
        await this.walletGenerator.recoverSolanaKeypair(fromEncryptedKey);

      const toPubkey = new PublicKey(toAddress);
      // Ensure amount is a string before parsing (payload might send it as number)
      const amountStr = typeof amount === 'string' ? amount : amount.toString();
      const lamports = Math.floor(parseFloat(amountStr) * LAMPORTS_PER_SOL);

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey,
        lamports,
      });

      // Create and send transaction
      const transaction = new Transaction().add(transferInstruction);

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );

      this.logger.log(`Solana SOL transfer completed: ${signature}`);

      // Get transaction details
      const txDetails = await connection.getTransaction(signature);

      return {
        success: true,
        txHash: signature,
        blockNumber: txDetails?.slot,
        gasUsed: txDetails?.meta?.fee?.toString(),
      };
    } catch (error: any) {
      this.logger.error(`Solana SOL transfer failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get SPL token balance
   */
  async getTokenBalance(
    tokenMint: string,
    walletAddress: string
  ): Promise<{ balance: string; decimals: number }> {
    try {
      const connection = this.getConnection();
      const mintPubkey = new PublicKey(tokenMint);
      const walletPubkey = new PublicKey(walletAddress);

      const tokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey
      );

      try {
        const accountInfo = await getAccount(connection, tokenAccount);
        // Note: We'd need to fetch mint info to get decimals
        // For now, assume 6 decimals (USDT/USDC standard)
        const decimals = 6;
        const balance = Number(accountInfo.amount) / Math.pow(10, decimals);

        return {
          balance: balance.toString(),
          decimals,
        };
      } catch {
        // Account doesn't exist - balance is 0
        return {
          balance: '0',
          decimals: 6,
        };
      }
    } catch (error: any) {
      this.logger.error(`Failed to get Solana token balance: ${error.message}`);
      return {
        balance: '0',
        decimals: 6,
      };
    }
  }

  /**
   * Get SOL balance
   */
  async getSolBalance(walletAddress: string): Promise<string> {
    const connection = this.getConnection();
    const pubkey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(pubkey);
    return (balance / LAMPORTS_PER_SOL).toString();
  }

  /**
   * Check if wallet needs SOL funding for rent
   */
  async needsFunding(walletAddress: string): Promise<boolean> {
    const balance = await this.getSolBalance(walletAddress);
    const threshold = this.walletConfig.getFundingThreshold('sol');
    return parseFloat(balance) < parseFloat(threshold);
  }

  /**
   * Fund wallet with SOL from funding wallet
   */
  async fundWalletWithSol(toAddress: string): Promise<TransactionResult> {
    // Get encrypted key - transferSol will decrypt it
    const fundingKey = await this.platformKeyService.getFundingWalletEncryptedKey('sol');
    const fundingAmount = this.walletConfig.getFundingAmount('sol');

    return this.transferSol(fundingKey, toAddress, fundingAmount);
  }

  /**
   * Execute withdrawal from hot wallet to external address
   */
  async executeWithdrawal(
    tokenMint: string,
    toAddress: string,
    amount: string,
    decimals: number
  ): Promise<TransactionResult> {
    // Get encrypted key - transferToken will decrypt it
    const hotWalletKey =
      await this.platformKeyService.getFundingWalletEncryptedKey('sol');

    return this.transferToken(
      tokenMint,
      hotWalletKey,
      toAddress,
      amount,
      decimals
    );
  }

  /**
   * Wait for transaction confirmation by polling
   */
  async waitForConfirmation(
    signature: string,
    maxWaitSeconds: number = 30
  ): Promise<boolean> {
    const connection = this.getConnection();
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const status = await connection.getSignatureStatus(signature);
        if (
          status?.value?.confirmationStatus === 'confirmed' ||
          status?.value?.confirmationStatus === 'finalized'
        ) {
          this.logger.debug(`Transaction ${signature} confirmed`);
          return true;
        }
        if (status?.value?.err) {
          this.logger.error(
            `Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`
          );
          return false;
        }
      } catch (error) {
        // Continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    this.logger.warn(
      `Transaction ${signature} confirmation timeout after ${maxWaitSeconds}s`
    );
    return false;
  }
}
