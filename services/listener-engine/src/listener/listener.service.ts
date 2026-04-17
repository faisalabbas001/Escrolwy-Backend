import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type ListenerChainId,
  type FullChainConfig,
  getChainConfig,
  isValidListenerChainId,
  getSupportedListenerChains,
  WATCHDOG_INTERVAL_MS,
  getRpcUrls,
} from '@escrowly/chain-config';
import { PrismaService } from '../prisma';
import { RedisService } from '../redis';
import { IChainListener, ListenerStatus } from './interfaces';
import { EvmListener, SolanaListener, TronListener } from './listeners';

// Type aliases for backwards compatibility
type ChainId = ListenerChainId;
type ChainConfig = FullChainConfig;

/**
 * Listener Service
 *
 * Orchestrates the blockchain listener based on CHAIN environment variable.
 * - Reads CHAIN from env (eth, bnb, poly, sol, trc)
 * - Creates the appropriate listener instance
 * - Manages lifecycle (start on init, stop on destroy)
 */
@Injectable()
export class ListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListenerService.name);
  private listeners: Map<ChainId, IChainListener> = new Map();
  private chainsToRun: ChainId[] = [];
  private chainConfigs: Map<ChainId, ChainConfig> = new Map();
  private retryCounts: Map<ChainId, number> = new Map();
  private restartTimers: Map<ChainId, NodeJS.Timeout> = new Map();
  private watchdog: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    // Determine chains to run. Default is "all".
    const chainEnv = this.configService.get<string>('CHAIN', 'all');
    const supported = getSupportedListenerChains();

    if (chainEnv === 'all' || chainEnv === '*' || chainEnv === '') {
      this.chainsToRun = supported;
    } else {
      const parsed = chainEnv
        .split(',')
        .map((c) => c.trim())
        .filter((c) => !!c) as string[];

      if (parsed.length === 0) {
        throw new Error(
          'Invalid CHAIN value. Provide comma-separated chain ids or use "all".',
        );
      }

      for (const chain of parsed) {
        if (!isValidListenerChainId(chain)) {
          throw new Error(
            `Invalid CHAIN value: ${chain}. Must be one of: ${supported.join(', ')}`,
          );
        }
      }

      this.chainsToRun = parsed as ChainId[];
    }

    // Cache chain configs
    for (const chainId of this.chainsToRun) {
      const cfg = getChainConfig(chainId);
      this.validateRpcConfig(chainId, cfg);
      this.chainConfigs.set(chainId, cfg);
      this.logger.log(`Configured for chain: ${cfg.metadata.name} (${chainId})`);
    }
  }

  /**
   * Initialize and start the listener on module init
   */
  async onModuleInit() {
    this.logger.log('Initializing listener service...');

    try {
      for (const chainId of this.chainsToRun) {
        await this.startChainListener(chainId);
      }
      this.startWatchdog();
    } catch (error) {
      this.logger.error(`❌ Failed to start listener: ${error.message}`, error.stack);
      // Don't throw - let the service run so health checks can report the error
    }
  }

  /**
   * Stop the listener on module destroy
   */
  async onModuleDestroy() {
    this.logger.log('Shutting down listener service (all chains)...');

    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }

    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }
    this.restartTimers.clear();

    for (const [chainId, listener] of this.listeners.entries()) {
      try {
        await listener.stop();
        this.logger.log(`Listener stopped for ${chainId}`);
      } catch (error) {
        this.logger.error(
          `Failed to stop listener for ${chainId}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Create the appropriate listener based on chain configuration
   */
  private createListener(chainId: ChainId): IChainListener {
    const chainConfig = this.chainConfigs.get(chainId) ?? getChainConfig(chainId);

    if (chainConfig.metadata.isEvm) {
      // EVM chains: ETH, Polygon, BSC
      return new EvmListener(
        chainConfig,
        this.prisma,
        this.redis,
        this.configService,
      );
    }

    // Non-EVM chains
    switch (chainId) {
      case 'sol':
        return new SolanaListener(
          chainConfig,
          this.prisma,
          this.redis,
          this.configService,
        );
      case 'trc':
        return new TronListener(
          chainConfig,
          this.prisma,
          this.redis,
          this.configService,
        );
      default:
        throw new Error(`No listener implementation for chain: ${chainId}`);
    }
  }

  /**
   * Get current listener status
   */
  async getStatuses(): Promise<Record<ChainId, ListenerStatus | null>> {
    const results: Record<ChainId, ListenerStatus | null> = {} as Record<
      ChainId,
      ListenerStatus | null
    >;

    for (const [chainId, listener] of this.listeners.entries()) {
      try {
        results[chainId] = await listener.getStatus();
      } catch (error) {
        this.logger.error(
          `Failed to get status for ${chainId}: ${error.message}`,
          error.stack,
        );
        results[chainId] = null;
      }
    }

    return results;
  }

  /**
   * Get chain IDs running in this instance
   */
  getChainIds(): ChainId[] {
    return this.chainsToRun;
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chainId: ChainId): ChainConfig | undefined {
    return this.chainConfigs.get(chainId);
  }

  /**
   * Check if listeners are running
   */
  isRunning(): boolean {
    return this.listeners.size > 0;
  }

  /**
   * Ensure RPC URL exists for the given chain before starting
   */
  private validateRpcConfig(chainId: ChainId, cfg: ChainConfig) {
    const urls = getRpcUrls(chainId, (k) => this.configService.get<string>(k));
    if (urls.length === 0) {
      throw new Error(
        `Missing RPC URL for ${cfg.metadata.name}. Set ${cfg.rpc.envKey} or ${cfg.rpc.envKeyPlural} in environment.`,
      );
    }
  }

  private async startChainListener(chainId: ChainId): Promise<void> {
    try {
      const existingTimer = this.restartTimers.get(chainId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.restartTimers.delete(chainId);
      }

      const listener = this.createListener(chainId);
      this.listeners.set(chainId, listener);

      this.logger.log(`Starting listener for ${chainId}...`);
      await listener.start();
      this.logger.log(`✅ ${chainId} listener started successfully`);
      this.retryCounts.set(chainId, 0);
    } catch (error) {
      this.logger.error(
        `❌ Listener for ${chainId} failed to start: ${error.message}`,
        error.stack,
      );
      this.scheduleRestart(chainId);
    }
  }

  private scheduleRestart(chainId: ChainId) {
    const attempts = (this.retryCounts.get(chainId) || 0) + 1;
    this.retryCounts.set(chainId, attempts);

    // Immediate restart with minimal delay (100ms) to avoid tight event loops
    // RPC failover will handle switching to backup RPCs automatically
    const delay = 100; // 100ms - effectively immediate

    this.logger.warn(
      `Restarting ${chainId} listener immediately (attempt ${attempts})...`,
    );

    const timer = setTimeout(() => {
      this.startChainListener(chainId).catch((err) =>
        this.logger.error(`Retry for ${chainId} failed: ${err.message}`),
      );
    }, delay);

    const existing = this.restartTimers.get(chainId);
    if (existing) {
      clearTimeout(existing);
    }
    this.restartTimers.set(chainId, timer);
  }

  private startWatchdog() {
    if (this.watchdog) {
      clearInterval(this.watchdog);
    }

    this.watchdog = setInterval(async () => {
      try {
        const statuses = await this.getStatuses();
        for (const chainId of this.chainsToRun) {
          const status = statuses[chainId];
          if (!status || !status.isRunning) {
            this.logger.warn(
              `Watchdog detected ${chainId} listener not running. Restarting immediately.`,
            );
            // Clear any existing restart timer and restart immediately
            const existing = this.restartTimers.get(chainId);
            if (existing) {
              clearTimeout(existing);
              this.restartTimers.delete(chainId);
            }
            // Restart immediately (no delay)
            this.startChainListener(chainId).catch((err) =>
              this.logger.error(`Watchdog restart for ${chainId} failed: ${err.message}`),
            );
          }
        }
      } catch (error) {
        this.logger.error(`Watchdog check failed: ${error.message}`);
      }
    }, WATCHDOG_INTERVAL_MS); // every 30s

    this.logger.log(`Watchdog started (polling every ${WATCHDOG_INTERVAL_MS}ms)`);
  }
}
