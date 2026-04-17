import { Logger } from '@nestjs/common';
import {
  type FullChainConfig,
  type ListenerChainId,
} from '@escrowly/chain-config';
import { PrismaService } from '../../prisma';
import { RedisService } from '../../redis';
import { RawTransferEvent } from '../dto';
import { IChainListener, ListenerMode, ListenerStatus } from '../interfaces';

// Type aliases for backwards compatibility
type ChainConfig = FullChainConfig;
type ChainId = ListenerChainId;

/**
 * Base Listener Abstract Class
 *
 * Provides common functionality for all chain listeners:
 * - Checkpoint management (read/write last_processed_block)
 * - Block confirmation handling (process only confirmed blocks)
 * - Replay mode (catch up on missed blocks)
 * - Real-time mode (subscribe to new blocks)
 * - Event pushing to Redis
 *
 * Chain-specific implementations must override:
 * - getCurrentBlockHeight()
 * - processBlock()
 *
 * Block Confirmation Logic:
 * - EVM/Tron chains: Process blocks that are N confirmations behind the tip
 * - Solana: Uses 'finalized' commitment level (no block buffer needed)
 * - Fresh start (lastProcessedBlock === 0): Start from safe block, no historical replay
 */
export abstract class BaseListener implements IChainListener {
  protected readonly logger: Logger;
  protected mode: ListenerMode = 'stopped';
  protected isRunning = false;
  protected startedAt: Date | null = null;
  protected eventsProcessed = 0;
  protected lastProcessedBlock = 0;
  protected currentChainBlock = 0;

  // Listener type - default is "deposit"
  protected readonly listenerType = 'deposit';

  // Confirmation settings from chain config
  protected readonly confirmations: number;
  protected readonly useFinalizedCommitment: boolean;

  constructor(
    public readonly chainConfig: ChainConfig,
    protected readonly prisma: PrismaService,
    protected readonly redis: RedisService,
  ) {
    this.logger = new Logger(`${this.constructor.name}:${chainConfig.metadata.chainId}`);

    // Initialize confirmation settings from chain config
    this.confirmations = chainConfig.confirmations.confirmations;
    this.useFinalizedCommitment = chainConfig.confirmations.useFinalizedCommitment;

    this.logger.log(
      `Confirmation settings: ${this.useFinalizedCommitment ? 'finalized commitment' : `${this.confirmations} block confirmations`}`,
    );
  }

  /**
   * Get the safe block height (confirmed blocks only)
   * For chains using block confirmations: currentBlock - confirmations
   * For chains using finalized commitment: currentBlock (already finalized)
   */
  protected getSafeBlockHeight(): number {
    if (this.useFinalizedCommitment) {
      // Solana: getCurrentBlockHeight already returns finalized slot
      return this.currentChainBlock;
    }
    // EVM/Tron: Apply confirmation buffer
    return Math.max(0, this.currentChainBlock - this.confirmations);
  }

  /**
   * Start the listener
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Listener is already running');
      return;
    }

    this.logger.log(`Starting ${this.chainConfig.metadata.name} listener...`);
    this.isRunning = true;
    this.startedAt = new Date();

    try {
      // Load last processed block from database
      await this.loadCheckpoint();

      // Get current chain block height
      this.currentChainBlock = await this.getCurrentBlockHeight();

      // Calculate safe block height (with confirmations)
      const safeBlock = this.getSafeBlockHeight();

      // Handle fresh start (lastProcessedBlock === 0)
      if (this.lastProcessedBlock === 0) {
        // Fresh start: begin from safe block, no historical replay
        this.lastProcessedBlock = safeBlock;
        await this.saveCheckpoint(safeBlock);
        this.logger.log(
          `🆕 Fresh start: Beginning from safe block ${safeBlock.toLocaleString()} (current: ${this.currentChainBlock.toLocaleString()}, confirmations: ${this.confirmations})`,
        );
      } else {
        const lag = safeBlock - this.lastProcessedBlock;
        this.logger.log(
          `📍 Last: ${this.lastProcessedBlock.toLocaleString()} | Current: ${this.currentChainBlock.toLocaleString()} | Safe: ${safeBlock.toLocaleString()} | Lag: ${lag.toLocaleString()} blocks`,
        );

        // Check if we need to replay (only up to safe block)
        if (this.lastProcessedBlock < safeBlock) {
          this.mode = 'replay';
          await this.replayBlocks();
        }
      }

      // Switch to real-time mode
      this.mode = 'realtime';
      await this.startRealTimeListening();
    } catch (error) {
      this.logger.error(`Failed to start listener: ${error.message}`, error.stack);
      this.isRunning = false;
      this.mode = 'stopped';
      throw error;
    }
  }

  /**
   * Stop the listener gracefully
   */
  async stop(): Promise<void> {
    this.logger.log('Stopping listener...');
    this.isRunning = false;
    this.mode = 'stopped';
    await this.stopRealTimeListening();
    this.logger.log('Listener stopped');
  }

  /**
   * Get current listener status
   */
  async getStatus(): Promise<ListenerStatus> {
    // Refresh current chain block
    try {
      this.currentChainBlock = await this.getCurrentBlockHeight();
    } catch (error) {
      this.logger.warn(`Failed to get current block height: ${error.message}`);
    }

    const safeBlock = this.getSafeBlockHeight();

    return {
      chain: this.chainConfig.metadata.chainId,
      mode: this.mode,
      lastProcessedBlock: this.lastProcessedBlock,
      currentChainBlock: this.currentChainBlock,
      safeBlock,
      confirmations: this.confirmations,
      lag: Math.max(0, safeBlock - this.lastProcessedBlock),
      useFinalizedCommitment: this.useFinalizedCommitment,
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      eventsProcessed: this.eventsProcessed,
    };
  }

  /**
   * Load checkpoint from database
   */
  protected async loadCheckpoint(): Promise<void> {
    const state = await this.prisma.listenerState.findUnique({
      where: {
        chain_listener_type_unique: {
          chain: this.chainConfig.metadata.chainId,
          listenerType: this.listenerType,
        },
      },
    });

    if (state) {
      this.lastProcessedBlock = Number(state.lastProcessedBlock);
      this.logger.log(
        `📍 Checkpoint loaded: Block ${this.lastProcessedBlock.toLocaleString()}`,
      );
    } else {
      // Create initial state record
      await this.prisma.listenerState.create({
        data: {
          chain: this.chainConfig.metadata.chainId,
          listenerType: this.listenerType,
          lastProcessedBlock: BigInt(0),
        },
      });
      this.lastProcessedBlock = 0;
      this.logger.log('📍 Created initial checkpoint at block 0');
    }
  }

  /**
   * Save checkpoint to database
   */
  protected async saveCheckpoint(blockNumber: number): Promise<void> {
    await this.prisma.listenerState.update({
      where: {
        chain_listener_type_unique: {
          chain: this.chainConfig.metadata.chainId,
          listenerType: this.listenerType,
        },
      },
      data: {
        lastProcessedBlock: BigInt(blockNumber),
        updatedAt: new Date(),
      },
    });
    this.lastProcessedBlock = blockNumber;
  }

  /**
   * Replay missed blocks sequentially (only up to safe block)
   */
  protected async replayBlocks(): Promise<void> {
    // Only replay up to safe block (with confirmations applied)
    const safeBlock = this.getSafeBlockHeight();
    const blocksToReplay = safeBlock - this.lastProcessedBlock;

    if (blocksToReplay <= 0) {
      this.logger.log('No blocks to replay (already at safe block)');
      return;
    }

    this.logger.log(
      `🔄 Replay Mode: Processing ${blocksToReplay.toLocaleString()} confirmed blocks (${(this.lastProcessedBlock + 1).toLocaleString()} → ${safeBlock.toLocaleString()})`,
    );

    const startBlock = this.lastProcessedBlock + 1;
    const endBlock = safeBlock;

    for (let block = startBlock; block <= endBlock && this.isRunning; block++) {
      try {
        const eventsCount = await this.processBlock(block);
        await this.saveCheckpoint(block);

        if (eventsCount > 0) {
          this.logger.log(
            `✅ Block ${block.toLocaleString()}: ${eventsCount} event${eventsCount > 1 ? 's' : ''} found → Redis`,
          );
        }

        // Log progress every 100 blocks
        if ((block - startBlock) % 100 === 0 && block !== startBlock) {
          const progress = (((block - startBlock) / (endBlock - startBlock)) * 100).toFixed(1);
          const remaining = endBlock - block;
          this.logger.log(
            `📊 Progress: ${progress}% | Block ${block.toLocaleString()}/${endBlock.toLocaleString()} | ${remaining.toLocaleString()} remaining`,
          );
        }

        // Small delay to avoid overwhelming the RPC
        await this.sleep(50);
      } catch (error) {
        this.logger.error(`Failed to process block ${block}: ${error.message}`);
        // Retry logic - wait and retry the same block
        await this.sleep(1000);
        // Retry once
        try {
          const eventsCount = await this.processBlock(block);
          await this.saveCheckpoint(block);
          this.logger.log(`Block ${block} (retry): ${eventsCount} events`);
        } catch (retryError) {
          this.logger.error(`Block ${block} failed on retry: ${retryError.message}`);
          throw retryError;
        }
      }
    }

    this.logger.log('Replay completed');
  }

  /**
   * Push events to Redis queue
   */
  protected async pushEvents(events: RawTransferEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.redis.pushEvents(this.chainConfig.queueName, events);
    this.eventsProcessed += events.length;
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Start real-time listening (to be implemented by subclasses)
   */
  protected abstract startRealTimeListening(): Promise<void>;

  /**
   * Stop real-time listening (to be implemented by subclasses)
   */
  protected abstract stopRealTimeListening(): Promise<void>;

  /**
   * Get current block height from blockchain RPC
   */
  abstract getCurrentBlockHeight(): Promise<number>;

  /**
   * Process a specific block and extract transfer events
   * @returns Number of events processed
   */
  abstract processBlock(blockNumber: number): Promise<number>;
}
