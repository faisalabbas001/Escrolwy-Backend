import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { RedisService, RawTransferEvent } from '../redis';
import { PrismaService } from '../prisma';
import { WalletEventProducer } from '../kafka';
import { getAllRedisQueueNames, mapListenerChainToWalletChain } from '../config';

/**
 * Deposit Processor Service
 *
 * Consumes raw blockchain events from Redis queues (pushed by listener-engine).
 * Processes deposits to user wallets.
 *
 * Flow:
 * 1. BLPOP from all raw_events_* queues
 * 2. Normalize raw event to deposit format
 * 3. Lookup user by deposit_address + chain in user_wallets
 * 4. If not found, skip (not our user's wallet)
 * 5. Insert deposit_transaction with status=pending
 * 6. Emit wallet.deposit.detected via outbox
 */
@Injectable()
export class DepositProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DepositProcessorService.name);
  private isRunning = false;
  private processingPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly walletEventProducer: WalletEventProducer
  ) {}

  async onModuleInit() {
    this.startProcessing();
  }

  async onModuleDestroy() {
    await this.stopProcessing();
  }

  /**
   * Start the deposit processing loop
   */
  private startProcessing() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.processingPromise = this.processLoop();
    this.logger.log('✅ Started deposit processor');
  }

  /**
   * Stop the deposit processing loop
   */
  private async stopProcessing() {
    this.isRunning = false;
    if (this.processingPromise) {
      await this.processingPromise;
    }
    this.logger.log('Deposit processor stopped');
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning && !this.redis.isShutdown()) {
      try {
        // BLPOP from all queues with 1 second timeout
        const result = await this.redis.blpop(getAllRedisQueueNames(), 1);

        if (!result) {
          // Timeout - no events available
          continue;
        }

        await this.processEvent(result.event);
      } catch (error: any) {
        if (!this.redis.isShutdown()) {
          this.logger.error(`Error in deposit processor: ${error.message}`);
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  /**
   * Process a single raw transfer event
   */
  private async processEvent(event: RawTransferEvent): Promise<void> {
    const { chain, txHash, to, amount, tokenSymbol, blockNumber, logIndex } =
      event;

    this.logger.debug(`Processing event: chain=${chain} tx=${txHash} to=${to}`);

    try {
      // Map listener chain to wallet chain
      const walletChain = mapListenerChainToWalletChain(chain);

      // Lookup user wallet by deposit address
      // For EVM, the same address works across all EVM chains
      const userWallet = await this.prisma.userWallet.findFirst({
        where: {
          depositAddress: { equals: to, mode: 'insensitive' },
          chain: walletChain,
        },
      });

      if (!userWallet) {
        // Not a deposit to one of our user wallets - skip
        this.logger.debug(`Address ${to} not found in user_wallets, skipping`);
        return;
      }

      // Check for duplicate (idempotency)
      const existingDeposit = await this.prisma.depositTransaction.findUnique({
        where: {
          chain_tx_hash_unique: {
            chain,
            txHash,
          },
        },
      });

      if (existingDeposit) {
        this.logger.debug(`Deposit ${txHash} already exists, skipping`);
        return;
      }

      // Create deposit transaction record
      const deposit = await this.prisma.depositTransaction.create({
        data: {
          userId: userWallet.userId,
          walletId: userWallet.id,
          chain,
          asset: tokenSymbol,
          amount,
          txHash,
          blockNumber: BigInt(blockNumber),
          depositAddress: to,
          status: 'pending',
          detectedAt: new Date(event.timestamp * 1000),
        },
      });

      this.logger.log(
        `Deposit detected: ${amount} ${tokenSymbol} to ${to} (user: ${userWallet.userId})`
      );

      // Emit deposit detected event
      await this.walletEventProducer.depositDetected(
        userWallet.userId,
        deposit.id,
        chain,
        tokenSymbol,
        amount,
        txHash,
        blockNumber,
        to
      );
    } catch (error: any) {
      this.logger.error(`Failed to process event ${txHash}: ${error.message}`);
      // Don't throw - we don't want to crash the processor
      // The event is already removed from Redis queue
      // In production, consider a dead-letter queue
    }
  }
}
