import { ConfigService } from '@nestjs/config';
import {
  type FullChainConfig,
  getRpcUrls,
  TRC20_TRANSFER_TOPIC,
} from '@escrowly/chain-config';
import { PrismaService } from '../../prisma';
import { RedisService } from '../../redis';
import { RawTransferEvent, createRawTransferEvent } from '../dto';
import { BaseListener } from './base.listener';

// Type alias for backwards compatibility
type ChainConfig = FullChainConfig;

// TronWeb types (tronweb doesn't have good TypeScript support)
declare const TronWeb: any;

interface TronBlock {
  blockID?: string;
  block_header: {
    raw_data: {
      number: number;
      timestamp: number;
    };
  };
  transactions?: Array<{
    txID: string;
    ret?: Array<{ contractRet: string }>;
  }>;
}

interface TronTransactionInfo {
  id: string;
  blockNumber: number;
  contractResult?: string[];
  receipt?: {
    result?: string;
  };
  log?: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

/**
 * Tron Listener (Optimized with Debug Logging)
 *
 * Handles blockchain listening for Tron network.
 * Uses tronweb to:
 * - Query block information
 * - Fetch TRC20 transfer events
 * - Filter transfers for configured tokens (USDT, USDC)
 *
 * IMPORTANT: TronWeb requires TronGrid-compatible RPC endpoints.
 * JSON-RPC endpoints (like Alchemy) are NOT compatible.
 * Use: https://api.trongrid.io or similar TronGrid-format endpoints.
 */
export class TronListener extends BaseListener {
  private tronWeb: any;
  private pollTimeoutHandle: NodeJS.Timeout | null = null;
  private tokenAddressSet: Set<string>;
  private tokenAddressToSymbol: Map<string, string>;
  private rpcUrls: string[];
  private rpcIndex = 0;

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

    // Validate RPC URL format - TronWeb needs TronGrid-style endpoints
    const rpcUrl = this.rpcUrls[this.rpcIndex];
    this.logger.log(`Using RPC: ${rpcUrl}`);

    // Get TronGrid API key from environment (optional but recommended)
    const tronApiKey = this.configService.get<string>('TRONGRID_API_KEY');

    // Initialize TronWeb with optional API key
    const TronWebLib = require('tronweb');
    const tronWebConfig: any = {
      fullHost: rpcUrl,
    };

    // Add API key header if provided
    if (tronApiKey) {
      tronWebConfig.headers = { 'TRON-PRO-API-KEY': tronApiKey };
      this.logger.log(`TronGrid API key configured`);
    }

    this.tronWeb = new TronWebLib(tronWebConfig);

    // Build token address lookup sets
    this.tokenAddressSet = new Set(chainConfig.tokens.map((t) => t.address));
    this.tokenAddressToSymbol = new Map(
      chainConfig.tokens.map((t) => [t.address, t.symbol]),
    );

    this.logger.log(`Initialized Tron listener`);
    this.logger.log(
      `Watching ${chainConfig.tokens.length} tokens: ${chainConfig.tokens.map((t) => `${t.symbol} (${t.address})`).join(', ')}`,
    );
  }

  /**
   * Get current block height
   */
  async getCurrentBlockHeight(): Promise<number> {
    try {
      const block = (await this.withRpc(() =>
        this.tronWeb.trx.getCurrentBlock(),
      )) as TronBlock;

      if (!block || !block.block_header) {
        throw new Error('Invalid block response - missing block_header');
      }

      const blockNumber = block.block_header.raw_data.number;
      this.logger.debug(`Current block height: ${blockNumber}`);
      return blockNumber;
    } catch (error) {
      this.logger.error(`Failed to get current block height: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a specific block and extract TRC20 transfer events
   *
   * OPTIMIZED: Uses getTransactionInfoByBlockNum to fetch ALL transaction info
   * in a single RPC call instead of fetching each transaction individually.
   * This reduces RPC calls from 1000+ per block to just 2.
   */
  async processBlock(blockNumber: number): Promise<number> {
    try {
      this.logger.debug(`Processing block ${blockNumber}...`);

      // Get block header for timestamp (1 RPC call)
      const block = (await this.withRpc(() =>
        this.tronWeb.trx.getBlock(blockNumber),
      )) as TronBlock;

      if (!block) {
        this.logger.debug(`Block ${blockNumber}: null response`);
        return 0;
      }

      const blockTimestamp = Math.floor(block.block_header.raw_data.timestamp / 1000);

      // Get ALL transaction info for the block in ONE call (1 RPC call)
      // This is the key optimization - instead of calling getTransactionInfo for each tx
      const allTxInfos = await this.getTransactionInfoByBlockNum(blockNumber);

      if (!allTxInfos || allTxInfos.length === 0) {
        this.logger.debug(`Block ${blockNumber}: no transaction info`);
        return 0;
      }

      const events: RawTransferEvent[] = [];
      let txWithLogsCount = 0;

      this.logger.debug(
        `Block ${blockNumber}: ${allTxInfos.length} transactions, timestamp: ${blockTimestamp}`,
      );

      // Process all transaction info from the batch response
      for (const txInfo of allTxInfos) {
        if (!txInfo.log || txInfo.log.length === 0) {
          continue;
        }

        txWithLogsCount++;

        // Process logs for TRC20 transfers
        for (let logIndex = 0; logIndex < txInfo.log.length; logIndex++) {
          const log = txInfo.log[logIndex];
          const event = this.parseTransferLog(
            log,
            txInfo.id,
            blockNumber,
            blockTimestamp,
            logIndex,
          );
          if (event) {
            events.push(event);
          }
        }
      }

      // Log block stats
      if (allTxInfos.length > 0 || events.length > 0) {
        this.logger.debug(
          `Block ${blockNumber}: ${allTxInfos.length} txs, ${txWithLogsCount} with logs, ${events.length} token events`,
        );
      }

      // Push events to Redis
      if (events.length > 0) {
        await this.pushEvents(events);
        this.logger.log(
          `Block ${blockNumber}: Found ${events.length} token transfer${events.length > 1 ? 's' : ''} for our tokens`,
        );
      }

      return events.length;
    } catch (error) {
      this.logger.error(`Failed to process block ${blockNumber}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get ALL transaction info for a block in ONE API call
   *
   * This is the key optimization - TronGrid's getTransactionInfoByBlockNum
   * returns all transaction info (including logs/events) for an entire block.
   * This reduces RPC calls from 1000+ (one per tx) to just 1 per block.
   */
  private async getTransactionInfoByBlockNum(
    blockNumber: number,
  ): Promise<TronTransactionInfo[]> {
    try {
      const rpcUrl = this.rpcUrls[this.rpcIndex];
      const tronApiKey = this.configService.get<string>('TRONGRID_API_KEY');

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (tronApiKey) {
        headers['TRON-PRO-API-KEY'] = tronApiKey;
      }

      // Make direct HTTP request to TronGrid API
      const response = await fetch(
        `${rpcUrl}/wallet/gettransactioninfobyblocknum`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ num: blockNumber }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // API returns array of transaction info objects
      if (!Array.isArray(data)) {
        this.logger.debug(
          `Block ${blockNumber}: unexpected response format, got ${typeof data}`,
        );
        return [];
      }

      return data as TronTransactionInfo[];
    } catch (error) {
      this.logger.warn(
        `Failed to get transaction info for block ${blockNumber}: ${error.message}`,
      );
      // Try rotating RPC and retry once
      this.rotateRpc();
      try {
        const rpcUrl = this.rpcUrls[this.rpcIndex];
        const tronApiKey = this.configService.get<string>('TRONGRID_API_KEY');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (tronApiKey) {
          headers['TRON-PRO-API-KEY'] = tronApiKey;
        }

        const response = await fetch(
          `${rpcUrl}/wallet/gettransactioninfobyblocknum`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ num: blockNumber }),
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? (data as TronTransactionInfo[]) : [];
      } catch (retryError) {
        this.logger.error(
          `Retry failed for block ${blockNumber}: ${retryError.message}`,
        );
        return [];
      }
    }
  }

  /**
   * Parse a TRC20 Transfer log into RawTransferEvent
   */
  private parseTransferLog(
    log: { address: string; topics: string[]; data: string },
    txHash: string,
    blockNumber: number,
    blockTimestamp: number,
    logIndex: number,
  ): RawTransferEvent | null {
    try {
      // Check if this is a Transfer event
      if (!log.topics || log.topics.length < 3) {
        return null;
      }

      // TRC20 Transfer topic (without 0x prefix)
      if (log.topics[0] !== TRC20_TRANSFER_TOPIC) {
        return null;
      }

      // Get contract address (token address)
      // log.address is in hex format without 0x prefix
      const tokenAddressHex = log.address;
      let tokenAddress: string;

      try {
        // Convert hex to base58 address
        tokenAddress = this.tronWeb.address.fromHex('41' + tokenAddressHex);
      } catch (e) {
        this.logger.debug(`Failed to convert token address ${tokenAddressHex}: ${e.message}`);
        return null;
      }

      // Check if this is one of our tokens
      if (!this.tokenAddressSet.has(tokenAddress)) {
        this.logger.debug(
          `Token ${tokenAddress} not in watch list (topic: ${log.topics[0].slice(0, 16)}...)`,
        );
        return null;
      }

      const tokenSymbol = this.tokenAddressToSymbol.get(tokenAddress);
      if (!tokenSymbol) {
        return null;
      }

      // Transfer(address indexed from, address indexed to, uint256 value)
      // topics[0] = event signature
      // topics[1] = from address (indexed, 32 bytes hex, last 20 bytes are address)
      // topics[2] = to address (indexed, 32 bytes hex, last 20 bytes are address)
      // data = value (hex without 0x prefix)

      if (!log.topics[1] || !log.topics[2]) {
        this.logger.debug(`Missing from/to topics in log`);
        return null;
      }

      // Decode addresses from topics
      // Tron addresses in logs are 32-byte hex, need last 20 bytes + 41 prefix
      let from: string;
      let to: string;

      try {
        const fromHex = '41' + log.topics[1].slice(-40); // Last 40 hex chars = 20 bytes
        const toHex = '41' + log.topics[2].slice(-40);
        from = this.tronWeb.address.fromHex(fromHex);
        to = this.tronWeb.address.fromHex(toHex);
      } catch (e) {
        this.logger.debug(`Failed to decode addresses: ${e.message}`);
        return null;
      }

      // Decode amount from data
      let amount: string;
      try {
        if (!log.data || log.data === '0' || log.data === '') {
          amount = '0';
        } else {
          amount = BigInt('0x' + log.data).toString();
        }
      } catch (e) {
        this.logger.debug(`Failed to decode amount from data "${log.data}": ${e.message}`);
        return null;
      }

      this.logger.debug(
        `Found ${tokenSymbol} transfer: ${amount} from ${from.slice(0, 8)}... to ${to.slice(0, 8)}...`,
      );

      return createRawTransferEvent(
        this.chainConfig.metadata.chainId,
        blockNumber,
        txHash,
        logIndex,
        from,
        to,
        amount,
        tokenSymbol,
        tokenAddress,
        blockTimestamp,
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
   * Only processes blocks that have sufficient confirmations.
   */
  protected async startRealTimeListening(): Promise<void> {
    this.logger.log(
      `Starting real-time block listening with ${this.confirmations} block confirmations...`,
    );

    const pollInterval = this.chainConfig.metadata.blockTimeMs;

    // Sequential polling function - schedules next poll after current completes
    const pollForBlocks = async () => {
      if (!this.isRunning) {
        this.logger.debug('Poll skipped: listener not running');
        return;
      }

      try {
        const currentBlock = await this.getCurrentBlockHeight();
        this.currentChainBlock = currentBlock;

        // Calculate safe block (with confirmations buffer)
        const safeBlock = this.getSafeBlockHeight();
        const blocksToProcess = safeBlock - this.lastProcessedBlock;

        if (blocksToProcess > 0) {
          this.logger.debug(
            `Poll: current=${currentBlock}, safe=${safeBlock}, lastProcessed=${this.lastProcessedBlock}, toProcess=${blocksToProcess}`,
          );
        }

        // Process only confirmed blocks (up to safeBlock)
        let processedCount = 0;
        let totalEvents = 0;

        while (this.lastProcessedBlock < safeBlock && this.isRunning) {
          const nextBlock = this.lastProcessedBlock + 1;

          try {
            const eventsCount = await this.processBlock(nextBlock);
            totalEvents += eventsCount;
            await this.saveCheckpoint(nextBlock);
            processedCount++;

            if (eventsCount > 0) {
              this.logger.log(`Block ${nextBlock} (confirmed): ${eventsCount} events`);
            }
          } catch (error) {
            this.logger.error(`Error processing block ${nextBlock}: ${error.message}`);
            // Don't throw - continue to next poll to retry
            break;
          }
        }

        if (processedCount > 0) {
          this.logger.debug(`Poll complete: ${processedCount} blocks, ${totalEvents} events`);
        }
      } catch (error) {
        this.logger.error(`Real-time processing error: ${error.message}`, error.stack);
      }

      // Schedule next poll only after current one completes
      if (this.isRunning) {
        this.pollTimeoutHandle = setTimeout(pollForBlocks, pollInterval);
      }
    };

    // Start first poll IMMEDIATELY (no delay)
    pollForBlocks();

    this.logger.log(
      `Real-time listening started (polling every ${pollInterval}ms, ${this.confirmations} confirmations)`,
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
   * Execute an RPC call with automatic failover
   */
  private async withRpc<T>(fn: () => Promise<T>): Promise<T> {
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

    const TronWebLib = require('tronweb');
    const tronApiKey = this.configService.get<string>('TRONGRID_API_KEY');
    const tronWebConfig: any = { fullHost: nextRpc };

    if (tronApiKey) {
      tronWebConfig.headers = { 'TRON-PRO-API-KEY': tronApiKey };
    }

    this.tronWeb = new TronWebLib(tronWebConfig);
  }
}
