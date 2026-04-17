import { Connection, PublicKey, TokenBalance } from '@solana/web3.js';
import { ConfigService } from '@nestjs/config';
import {
  type FullChainConfig,
  getRpcUrls,
  SOLANA_TOKEN_PROGRAM_ID,
} from '@escrowly/chain-config';
import { PrismaService } from '../../prisma';
import { RedisService } from '../../redis';
import { RawTransferEvent, createRawTransferEvent } from '../dto';
import { BaseListener } from './base.listener';

// Type alias for backwards compatibility
type ChainConfig = FullChainConfig;

/**
 * Solana Listener (Optimized for RPC Efficiency)
 *
 * Handles blockchain listening for Solana with minimal RPC calls.
 *
 * Key Optimization: Uses preTokenBalances/postTokenBalances from getBlock()
 * instead of fetching each transaction individually. This reduces RPC calls
 * from potentially 1000+ per block to just 1.
 *
 * Flow:
 * 1. getBlock() with transaction details (1 RPC call per slot)
 * 2. For each transaction, compare pre/post token balances
 * 3. Detect transfers for our configured tokens (USDT, USDC, DAI)
 * 4. Push events to Redis for wallet-service processing
 *
 * Checkpoint: Last processed block is saved to DB after each slot,
 * ensuring we resume from the correct position after restarts.
 */
export class SolanaListener extends BaseListener {
  private connection: Connection;
  private pollTimeoutHandle: NodeJS.Timeout | null = null;
  private tokenMintSet: Set<string>;
  private tokenMintToSymbol: Map<string, string>;
  private tokenMintToDecimals: Map<string, number>;
  private rpcUrls: string[];
  private rpcIndex = 0;

  /**
   * Solana commitment level for finality
   * 'finalized' = 31+ confirmations, highest level of certainty
   */
  private readonly commitment = 'finalized' as const;

  constructor(
    chainConfig: ChainConfig,
    prisma: PrismaService,
    redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    super(chainConfig, prisma, redis);

    // Get RPC URLs (plural support)
    this.rpcUrls = getRpcUrls(chainConfig.metadata.chainId, (k) =>
      this.configService.get<string>(k),
    );
    if (this.rpcUrls.length === 0) {
      throw new Error(
        `RPC URL not configured for ${chainConfig.metadata.name}. Set ${chainConfig.rpc.envKey} or ${chainConfig.rpc.envKeyPlural} in environment.`,
      );
    }

    // Initialize connection with 'finalized' commitment for maximum finality guarantee
    this.connection = new Connection(this.rpcUrls[this.rpcIndex], this.commitment);

    // Build token mint lookup sets
    this.tokenMintSet = new Set(chainConfig.tokens.map((t) => t.address));
    this.tokenMintToSymbol = new Map(
      chainConfig.tokens.map((t) => [t.address, t.symbol]),
    );
    this.tokenMintToDecimals = new Map(
      chainConfig.tokens.map((t) => [t.address, t.decimals]),
    );

    this.logger.log(`Initialized Solana listener with '${this.commitment}' commitment`);
    this.logger.log(`Watching ${chainConfig.tokens.length} tokens: ${chainConfig.tokens.map((t) => t.symbol).join(', ')}`);
  }

  /**
   * Get current slot (block) height
   */
  async getCurrentBlockHeight(): Promise<number> {
    return this.withConnection(() => this.connection.getSlot());
  }

  /**
   * Process a specific slot and extract token transfer events
   *
   * Optimized approach (1 RPC call per slot):
   * 1. Get block with full transaction details
   * 2. For each successful transaction, analyze pre/post token balances
   * 3. Detect balance changes for our configured tokens
   * 4. Create transfer events from balance diffs
   */
  async processBlock(slotNumber: number): Promise<number> {
    try {
      // Get block with transactions - THIS IS THE ONLY RPC CALL PER SLOT
      const block = await this.withConnection(() =>
        this.connection.getBlock(slotNumber, {
          maxSupportedTransactionVersion: 0,
          transactionDetails: 'full',
          rewards: false, // Don't need rewards, saves bandwidth
        }),
      );

      if (!block) {
        // Slot might be skipped (leader didn't produce a block)
        return 0;
      }

      if (!block.transactions || block.transactions.length === 0) {
        return 0;
      }

      const events: RawTransferEvent[] = [];
      const blockTimestamp = block.blockTime || Math.floor(Date.now() / 1000);

      // Process each transaction using pre/post token balances
      for (let txIndex = 0; txIndex < block.transactions.length; txIndex++) {
        const tx = block.transactions[txIndex];

        // Skip failed transactions
        if (!tx.meta || tx.meta.err) {
          continue;
        }

        // Extract transfers from token balance changes
        const txEvents = this.extractTransfersFromBalances(
          tx.meta.preTokenBalances || [],
          tx.meta.postTokenBalances || [],
          tx.transaction.signatures[0],
          slotNumber,
          blockTimestamp,
          txIndex,
        );

        events.push(...txEvents);
      }

      // Push events to Redis
      if (events.length > 0) {
        await this.pushEvents(events);
        this.logger.log(
          `Slot ${slotNumber}: Found ${events.length} token transfer${events.length > 1 ? 's' : ''} for our tokens`,
        );
      }

      return events.length;
    } catch (error) {
      // Slot might be skipped or unavailable
      if (
        error.message?.includes('Slot was skipped') ||
        error.message?.includes('was skipped, or missing')
      ) {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Extract token transfers by comparing pre and post token balances
   *
   * This is the core optimization - we don't need to fetch parsed transactions
   * because the block response already contains token balance changes.
   *
   * For each transaction:
   * 1. Build a map of account -> pre-balance for our tokens
   * 2. Build a map of account -> post-balance for our tokens
   * 3. Find accounts where balance decreased (sender) and increased (receiver)
   * 4. Match sender/receiver pairs by mint and amount
   */
  private extractTransfersFromBalances(
    preBalances: TokenBalance[],
    postBalances: TokenBalance[],
    txHash: string,
    slotNumber: number,
    blockTimestamp: number,
    txIndex: number,
  ): RawTransferEvent[] {
    const events: RawTransferEvent[] = [];

    // Filter to only our watched tokens
    const relevantPreBalances = preBalances.filter(
      (b) => this.tokenMintSet.has(b.mint),
    );
    const relevantPostBalances = postBalances.filter(
      (b) => this.tokenMintSet.has(b.mint),
    );

    // If no relevant token activity, skip
    if (relevantPreBalances.length === 0 && relevantPostBalances.length === 0) {
      return events;
    }

    // Build balance maps: accountIndex -> { mint, owner, amount }
    const preMap = new Map<number, { mint: string; owner: string; amount: bigint }>();
    const postMap = new Map<number, { mint: string; owner: string; amount: bigint }>();

    for (const bal of relevantPreBalances) {
      preMap.set(bal.accountIndex, {
        mint: bal.mint,
        owner: bal.owner || '',
        amount: BigInt(bal.uiTokenAmount.amount),
      });
    }

    for (const bal of relevantPostBalances) {
      postMap.set(bal.accountIndex, {
        mint: bal.mint,
        owner: bal.owner || '',
        amount: BigInt(bal.uiTokenAmount.amount),
      });
    }

    // Find all account indices that had activity
    const allAccountIndices = new Set([...preMap.keys(), ...postMap.keys()]);

    // Group by mint to match senders and receivers
    const balanceChanges = new Map<
      string, // mint
      { accountIndex: number; owner: string; change: bigint }[]
    >();

    for (const accountIndex of allAccountIndices) {
      const pre = preMap.get(accountIndex);
      const post = postMap.get(accountIndex);

      // Determine the mint (prefer post, fallback to pre)
      const mint = post?.mint || pre?.mint;
      if (!mint) continue;

      const preAmount = pre?.amount || 0n;
      const postAmount = post?.amount || 0n;
      const change = postAmount - preAmount;

      // Skip if no change
      if (change === 0n) continue;

      // Get owner (prefer the one that has it)
      const owner = post?.owner || pre?.owner || '';

      if (!balanceChanges.has(mint)) {
        balanceChanges.set(mint, []);
      }
      balanceChanges.get(mint)!.push({ accountIndex, owner, change });
    }

    // For each mint, match senders (negative change) with receivers (positive change)
    let logIndex = txIndex * 1000; // Unique log index per tx

    for (const [mint, changes] of balanceChanges) {
      const senders = changes.filter((c) => c.change < 0n);
      const receivers = changes.filter((c) => c.change > 0n);

      // For each sender, try to find matching receiver(s)
      for (const sender of senders) {
        const amountSent = -sender.change; // Make positive

        for (const receiver of receivers) {
          // Check if this receiver received the same amount (or part of it)
          if (receiver.change > 0n) {
            const amountReceived = receiver.change;

            // Use the smaller of the two as the transfer amount
            const transferAmount = amountSent < amountReceived ? amountSent : amountReceived;

            if (transferAmount > 0n) {
              const tokenSymbol = this.tokenMintToSymbol.get(mint)!;

              events.push(
                createRawTransferEvent(
                  this.chainConfig.metadata.chainId,
                  slotNumber,
                  txHash,
                  logIndex++,
                  sender.owner,      // from (owner of the sending token account)
                  receiver.owner,    // to (owner of the receiving token account)
                  transferAmount.toString(),
                  tokenSymbol,
                  mint,
                  blockTimestamp,
                ),
              );

              this.logger.debug(
                `Found ${tokenSymbol} transfer: ${transferAmount.toString()} from ${sender.owner.slice(0, 8)}... to ${receiver.owner.slice(0, 8)}...`,
              );

              // Reduce the receiver's remaining amount
              receiver.change -= transferAmount;
            }
          }
        }
      }
    }

    return events;
  }

  /**
   * Start real-time slot listening
   *
   * Uses sequential polling to prevent overlapping executions.
   * The next poll only starts after the current one completes.
   * Uses 'finalized' commitment level, so getCurrentBlockHeight() returns
   * the latest finalized slot. No additional confirmation buffer is needed
   * since finalized slots are already guaranteed to be permanent.
   */
  protected async startRealTimeListening(): Promise<void> {
    this.logger.log(`Starting real-time slot listening with '${this.commitment}' commitment...`);

    // Solana is fast (~400ms slots), poll every 2 slots to batch efficiently
    const pollInterval = this.chainConfig.metadata.blockTimeMs * 2;

    // Sequential polling function - schedules next poll after current completes
    const pollForSlots = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        // Get latest finalized slot (1 RPC call)
        const currentSlot = await this.getCurrentBlockHeight();
        this.currentChainBlock = currentSlot;

        const slotsToProcess = currentSlot - this.lastProcessedBlock;

        if (slotsToProcess > 0) {
          this.logger.debug(
            `Poll: processing ${slotsToProcess} slots (${this.lastProcessedBlock + 1} → ${currentSlot})`,
          );
        }

        // Process new finalized slots
        let processedCount = 0;
        let totalEvents = 0;

        while (this.lastProcessedBlock < currentSlot && this.isRunning) {
          const nextSlot = this.lastProcessedBlock + 1;

          try {
            const eventsCount = await this.processBlock(nextSlot);
            totalEvents += eventsCount;
            await this.saveCheckpoint(nextSlot);
            processedCount++;
          } catch (error) {
            // Handle skipped slots gracefully
            if (
              error.message?.includes('Slot was skipped') ||
              error.message?.includes('was skipped, or missing')
            ) {
              await this.saveCheckpoint(nextSlot);
              processedCount++;
            } else {
              this.logger.error(`Error processing slot ${nextSlot}: ${error.message}`);
              throw error;
            }
          }
        }

        if (processedCount > 0) {
          this.logger.debug(
            `Poll complete: ${processedCount} slots, ${totalEvents} events`,
          );
        }
      } catch (error) {
        this.logger.error(`Real-time processing error: ${error.message}`, error.stack);
      }

      // Schedule next poll only after current one completes
      if (this.isRunning) {
        this.pollTimeoutHandle = setTimeout(pollForSlots, pollInterval);
      }
    };

    // Start first poll immediately (no delay)
    pollForSlots();

    this.logger.log(
      `Real-time listening started (polling every ${pollInterval}ms, commitment: ${this.commitment})`,
    );
  }

  /**
   * Stop real-time slot listening
   */
  protected async stopRealTimeListening(): Promise<void> {
    if (this.pollTimeoutHandle) {
      clearTimeout(this.pollTimeoutHandle);
      this.pollTimeoutHandle = null;
      this.logger.log('Real-time listening stopped');
    }
  }

  /**
   * Execute a connection call with automatic RPC failover
   */
  private async withConnection<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn(
        `RPC error on ${this.rpcUrls[this.rpcIndex]}: ${error.message}. Switching RPC...`,
      );
      this.rotateRpc();
      return fn();
    }
  }

  private rotateRpc() {
    this.rpcIndex = (this.rpcIndex + 1) % this.rpcUrls.length;
    const nextRpc = this.rpcUrls[this.rpcIndex];
    this.logger.warn(`Switching to RPC: ${nextRpc.slice(0, 50)}...`);
    // Maintain 'finalized' commitment when rotating RPC
    this.connection = new Connection(nextRpc, this.commitment);
  }
}
