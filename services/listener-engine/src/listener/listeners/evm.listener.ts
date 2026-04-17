import { ethers, JsonRpcProvider, Log, Block } from 'ethers';
import { ConfigService } from '@nestjs/config';
import {
  type FullChainConfig,
  ERC20_TRANSFER_TOPIC,
  getRpcUrls,
} from '@escrowly/chain-config';
import { PrismaService } from '../../prisma';
import { RedisService } from '../../redis';
import { RawTransferEvent, createRawTransferEvent } from '../dto';
import { BaseListener } from './base.listener';

// Type alias for backwards compatibility
type ChainConfig = FullChainConfig;

/**
 * EVM Listener
 *
 * Handles blockchain listening for EVM-compatible chains:
 * - Ethereum (ETH)
 * - BNB Smart Chain (BSC)
 * - Polygon (POLY)
 *
 * Uses ethers.js v6 to:
 * - Query historical blocks via getLogs()
 * - Subscribe to new blocks in real-time
 * - Filter ERC20 Transfer events for configured tokens
 */
export class EvmListener extends BaseListener {
  private provider: JsonRpcProvider;
  private rpcUrls: string[];
  private rpcIndex = 0;
  private pollTimeoutHandle: NodeJS.Timeout | null = null;
  private tokenAddressSet: Set<string>;
  private tokenAddressToSymbol: Map<string, string>;

  constructor(
    chainConfig: ChainConfig,
    prisma: PrismaService,
    redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    super(chainConfig, prisma, redis);

    // Resolve RPC URLs (supports plural env var)
    this.rpcUrls = getRpcUrls(chainConfig.metadata.chainId, (k) =>
      this.configService.get<string>(k),
    );
    if (this.rpcUrls.length === 0) {
      throw new Error(
        `RPC URL not configured for ${chainConfig.metadata.name}. Set ${chainConfig.rpc.envKey} or ${chainConfig.rpc.envKeyPlural} in environment.`,
      );
    }

    // Initialize provider
    this.provider = new JsonRpcProvider(this.rpcUrls[this.rpcIndex]);

    // Build token address lookup sets (lowercase for comparison)
    this.tokenAddressSet = new Set(
      chainConfig.tokens.map((t) => t.address.toLowerCase()),
    );
    this.tokenAddressToSymbol = new Map(
      chainConfig.tokens.map((t) => [t.address.toLowerCase(), t.symbol]),
    );

    this.logger.log(`Initialized EVM listener for ${chainConfig.metadata.name}`);
    this.logger.log(`Watching ${chainConfig.tokens.length} tokens: ${chainConfig.tokens.map((t) => t.symbol).join(', ')}`);
  }

  /**
   * Get current block height from the chain
   */
  async getCurrentBlockHeight(): Promise<number> {
    return this.withProvider(() => this.provider.getBlockNumber());
  }

  /**
   * Process a specific block and extract transfer events
   */
  async processBlock(blockNumber: number): Promise<number> {
    // Get all Transfer logs for our token addresses in this block
    const logs = await this.withProvider(() =>
      this.provider.getLogs({
        fromBlock: blockNumber,
        toBlock: blockNumber,
        topics: [ERC20_TRANSFER_TOPIC],
      }),
    );

    // Filter logs for our tokens and parse them
    const events: RawTransferEvent[] = [];

    for (const log of logs) {
      const tokenAddress = log.address.toLowerCase();

      // Skip if not one of our tokens
      if (!this.tokenAddressSet.has(tokenAddress)) {
        continue;
      }

      // Parse the Transfer event
      const event = this.parseTransferLog(log, blockNumber);
      if (event) {
        events.push(event);
      }
    }

    // Push events to Redis
    if (events.length > 0) {
      await this.pushEvents(events);
    }

    return events.length;
  }

  /**
   * Parse a Transfer log into RawTransferEvent
   */
  private parseTransferLog(log: Log, blockNumber: number): RawTransferEvent | null {
    try {
      const tokenAddress = log.address.toLowerCase();
      const tokenSymbol = this.tokenAddressToSymbol.get(tokenAddress);

      if (!tokenSymbol) {
        return null;
      }

      // Transfer(address indexed from, address indexed to, uint256 value)
      // topics[0] = event signature
      // topics[1] = from address (indexed)
      // topics[2] = to address (indexed)
      // data = value (non-indexed)

      if (!log.topics[1] || !log.topics[2]) {
        return null;
      }

      // Decode addresses from topics (remove padding)
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);

      // Decode amount from data
      const amount = BigInt(log.data).toString();

      // Get block timestamp (we'll fetch it lazily if needed)
      // For performance, we use block number as approximate timestamp
      // The Worker service can fetch exact timestamp if needed
      const timestamp = Math.floor(Date.now() / 1000);

      return createRawTransferEvent(
        this.chainConfig.metadata.chainId,
        blockNumber,
        log.transactionHash,
        log.index,
        from,
        to,
        amount,
        tokenSymbol,
        log.address,
        timestamp,
      );
    } catch (error) {
      this.logger.warn(`Failed to parse log: ${error.message}`);
      return null;
    }
  }

  /**
   * Start real-time block listening
   *
   * Uses sequential polling to prevent overlapping executions.
   * The next poll only starts after the current one completes.
   * This ensures we only push confirmed transactions to Redis,
   * protecting against chain reorganizations and flash token attacks.
   */
  protected async startRealTimeListening(): Promise<void> {
    this.logger.log(
      `Starting real-time block listening with ${this.confirmations} block confirmations...`,
    );

    const pollInterval = this.chainConfig.metadata.blockTimeMs;

    // Sequential polling function - schedules next poll after current completes
    const pollForBlocks = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        const currentBlock = await this.getCurrentBlockHeight();
        this.currentChainBlock = currentBlock;

        // Calculate safe block (with confirmations buffer)
        const safeBlock = this.getSafeBlockHeight();

        // Process only confirmed blocks (up to safeBlock)
        while (this.lastProcessedBlock < safeBlock && this.isRunning) {
          const nextBlock = this.lastProcessedBlock + 1;
          const eventsCount = await this.processBlock(nextBlock);
          await this.saveCheckpoint(nextBlock);

          if (eventsCount > 0) {
            this.logger.log(
              `Block ${nextBlock} (confirmed): ${eventsCount} events`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Real-time processing error: ${error.message}`);
      }

      // Schedule next poll only after current one completes
      if (this.isRunning) {
        this.pollTimeoutHandle = setTimeout(pollForBlocks, pollInterval);
      }
    };

    // Start first poll
    this.pollTimeoutHandle = setTimeout(pollForBlocks, pollInterval);

    this.logger.log(
      `Real-time listening started (sequential polling every ${pollInterval}ms, ${this.confirmations} confirmations)`,
    );
  }

  /**
   * Stop real-time block listening
   */
  protected async stopRealTimeListening(): Promise<void> {
    if (this.pollTimeoutHandle) {
      clearTimeout(this.pollTimeoutHandle);
      this.pollTimeoutHandle = null;
      this.logger.log('Real-time listening stopped');
    }
  }

  /**
   * Process a block with full timestamp (slower but accurate)
   */
  async processBlockWithTimestamp(blockNumber: number): Promise<number> {
    // Get block with timestamp
    const block = await this.withProvider(() => this.provider.getBlock(blockNumber));
    if (!block) {
      throw new Error(`Block ${blockNumber} not found`);
    }

    // Get all Transfer logs for our token addresses in this block
    const logs = await this.withProvider(() =>
      this.provider.getLogs({
        fromBlock: blockNumber,
        toBlock: blockNumber,
        topics: [ERC20_TRANSFER_TOPIC],
      }),
    );

    // Filter logs for our tokens and parse them
    const events: RawTransferEvent[] = [];

    for (const log of logs) {
      const tokenAddress = log.address.toLowerCase();

      if (!this.tokenAddressSet.has(tokenAddress)) {
        continue;
      }

      const event = this.parseTransferLogWithBlock(log, block);
      if (event) {
        events.push(event);
      }
    }

    if (events.length > 0) {
      await this.pushEvents(events);
    }

    return events.length;
  }

  /**
   * Parse Transfer log with block data for accurate timestamp
   */
  private parseTransferLogWithBlock(log: Log, block: Block): RawTransferEvent | null {
    try {
      const tokenAddress = log.address.toLowerCase();
      const tokenSymbol = this.tokenAddressToSymbol.get(tokenAddress);

      if (!tokenSymbol || !log.topics[1] || !log.topics[2]) {
        return null;
      }

      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const amount = BigInt(log.data).toString();

      return createRawTransferEvent(
        this.chainConfig.metadata.chainId,
        block.number,
        log.transactionHash,
        log.index,
        from,
        to,
        amount,
        tokenSymbol,
        log.address,
        block.timestamp,
      );
    } catch (error) {
      this.logger.warn(`Failed to parse log with block: ${error.message}`);
      return null;
    }
  }

  /**
   * Execute a provider call with automatic RPC failover
   */
  private async withProvider<T>(fn: () => Promise<T>): Promise<T> {
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

  /**
   * Move to the next RPC URL and recreate provider
   */
  private rotateRpc() {
    this.rpcIndex = (this.rpcIndex + 1) % this.rpcUrls.length;
    const nextRpc = this.rpcUrls[this.rpcIndex];
    this.logger.warn(`Switching to RPC ${nextRpc}`);
    this.provider = new JsonRpcProvider(nextRpc);
  }
}

