/**
 * RPC Configuration with Unified Fallback System
 *
 * Provides a centralized RPC management system with:
 * - Multiple RPC endpoints per chain
 * - Automatic failover on errors
 * - Environment variable configuration
 * - Default public endpoints as fallback
 */

import { ListenerChainId, ChainRpcConfig, RpcProviderConfig } from '../types';

// =============================================================================
// RPC ENVIRONMENT VARIABLE KEYS
// =============================================================================

export const RPC_ENV_KEYS: Record<
  ListenerChainId,
  { single: string; plural: string }
> = {
  eth: { single: 'ETH_RPC_URL', plural: 'ETH_RPC_URLS' },
  bnb: { single: 'BSC_RPC_URL', plural: 'BSC_RPC_URLS' },
  poly: { single: 'POLYGON_RPC_URL', plural: 'POLYGON_RPC_URLS' },
  sol: { single: 'SOLANA_RPC_URL', plural: 'SOLANA_RPC_URLS' },
  trc: { single: 'TRON_RPC_URL', plural: 'TRON_RPC_URLS' },
};

// =============================================================================
// DEFAULT PUBLIC RPC ENDPOINTS (Fallback)
// =============================================================================

/**
 * Default public RPC endpoints for each chain
 * These are used as fallback when no environment variables are set
 * NOTE: Public RPCs have rate limits - use private RPCs in production
 */
// export const DEFAULT_RPC_ENDPOINTS: Record<ListenerChainId, string[]> = {
//   eth: ['https://mainnet.infura.io/v3/692aecd5d6a34f81b7a411fca25aaca8'],
//   bnb: ['https://bsc-mainnet.infura.io/v3/692aecd5d6a34f81b7a411fca25aaca8'],
//   poly: [
//     'https://polygon-mainnet.infura.io/v3/692aecd5d6a34f81b7a411fca25aaca8',
//   ],
//   sol: [
//     'https://mainnet.helius-rpc.com/?api-key=3053854a-603c-480a-877c-644900979735',
//     'https://api.mainnet-beta.solana.com',
//     'https://solana-api.projectserum.com',
//   ],
//   trc: [
//     'https://responsive-small-breeze.tron-mainnet.quiknode.pro/113a1816f81a0e18b43840014dde71524d253c47/jsonrpc',
//   ],
// };
export const DEFAULT_RPC_ENDPOINTS: Record<ListenerChainId, string[]> = {
  eth: ['https://hoodi.infura.io/v3/692aecd5d6a34f81b7a411fca25aaca8'],
  bnb: ['https://bsc-mainnet.infura.io/v3/692aecd5d6a34f81b7a411fca25aaca8'],
  poly: ['https://polygon-amoy.infura.io/v3/692aecd5d6a34f81b7a411fca25aaca8'],
  sol: ['https://devnet.helius-rpc.com/?api-key=12ee58b4-43f8-4f67-931f-158ffde5c9cc'],
  trc: ['https://nile.trongrid.io'],
};

// =============================================================================
// RPC CONFIGURATION BY CHAIN
// =============================================================================

export const RPC_CONFIGS: Record<ListenerChainId, ChainRpcConfig> = {
  eth: {
    chainId: 'eth',
    envKey: RPC_ENV_KEYS.eth.single,
    envKeyPlural: RPC_ENV_KEYS.eth.plural,
    defaultEndpoints: DEFAULT_RPC_ENDPOINTS.eth,
  },
  bnb: {
    chainId: 'bnb',
    envKey: RPC_ENV_KEYS.bnb.single,
    envKeyPlural: RPC_ENV_KEYS.bnb.plural,
    defaultEndpoints: DEFAULT_RPC_ENDPOINTS.bnb,
  },
  poly: {
    chainId: 'poly',
    envKey: RPC_ENV_KEYS.poly.single,
    envKeyPlural: RPC_ENV_KEYS.poly.plural,
    defaultEndpoints: DEFAULT_RPC_ENDPOINTS.poly,
  },
  sol: {
    chainId: 'sol',
    envKey: RPC_ENV_KEYS.sol.single,
    envKeyPlural: RPC_ENV_KEYS.sol.plural,
    defaultEndpoints: DEFAULT_RPC_ENDPOINTS.sol,
  },
  trc: {
    chainId: 'trc',
    envKey: RPC_ENV_KEYS.trc.single,
    envKeyPlural: RPC_ENV_KEYS.trc.plural,
    defaultEndpoints: DEFAULT_RPC_ENDPOINTS.trc,
  },
};

// =============================================================================
// RPC RESOLUTION UTILITIES
// =============================================================================

/**
 * Get RPC URLs for a chain from environment variables
 *
 * Resolution order:
 * 1. Plural env var (comma-separated): ETH_RPC_URLS
 * 2. Single env var: ETH_RPC_URL
 * 3. Default public endpoints (fallback)
 *
 * @param chainId - The chain identifier
 * @param getEnv - Function to get environment variable value
 * @returns Array of RPC URLs
 */
export function getRpcUrls(
  chainId: ListenerChainId,
  getEnv: (key: string) => string | undefined
): string[] {
  const config = RPC_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unknown chain: ${chainId}`);
  }

  // Try plural env var first (comma-separated)
  const pluralValue = getEnv(config.envKeyPlural);
  if (pluralValue) {
    const urls = pluralValue
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      return urls;
    }
  }

  // Try single env var
  const singleValue = getEnv(config.envKey);
  if (singleValue) {
    return [singleValue.trim()];
  }

  // Fall back to default public endpoints
  return config.defaultEndpoints;
}

/**
 * Get a single RPC URL for a chain (first available)
 *
 * @param chainId - The chain identifier
 * @param getEnv - Function to get environment variable value
 * @returns Single RPC URL
 */
export function getRpcUrl(
  chainId: ListenerChainId,
  getEnv: (key: string) => string | undefined
): string {
  const urls = getRpcUrls(chainId, getEnv);
  if (urls.length === 0) {
    throw new Error(`No RPC URL configured for chain: ${chainId}`);
  }
  return urls[0];
}

/**
 * Create an RPC provider configuration with failover support
 *
 * @param chainId - The chain identifier
 * @param getEnv - Function to get environment variable value
 * @returns RPC provider configuration
 */
export function createRpcProvider(
  chainId: ListenerChainId,
  getEnv: (key: string) => string | undefined
): RpcProviderConfig {
  const urls = getRpcUrls(chainId, getEnv);
  if (urls.length === 0) {
    throw new Error(`No RPC URL configured for chain: ${chainId}`);
  }

  return {
    currentUrl: urls[0],
    urls,
    currentIndex: 0,
  };
}

/**
 * Rotate to the next RPC URL in the provider configuration
 *
 * @param provider - Current RPC provider configuration
 * @returns Updated RPC provider configuration with next URL
 */
export function rotateRpc(provider: RpcProviderConfig): RpcProviderConfig {
  const nextIndex = (provider.currentIndex + 1) % provider.urls.length;
  return {
    ...provider,
    currentIndex: nextIndex,
    currentUrl: provider.urls[nextIndex],
  };
}

// =============================================================================
// RPC MANAGER CLASS
// =============================================================================

/**
 * RPC Manager for a specific chain
 *
 * Manages RPC endpoints with automatic failover support.
 * Use this class when you need stateful RPC management.
 */
export class RpcManager {
  private urls: string[];
  private currentIndex: number = 0;

  constructor(
    public readonly chainId: ListenerChainId,
    getEnv: (key: string) => string | undefined
  ) {
    this.urls = getRpcUrls(chainId, getEnv);
    if (this.urls.length === 0) {
      throw new Error(`No RPC URL configured for chain: ${chainId}`);
    }
  }

  /**
   * Get current RPC URL
   */
  get currentUrl(): string {
    return this.urls[this.currentIndex];
  }

  /**
   * Get all configured RPC URLs
   */
  get allUrls(): string[] {
    return [...this.urls];
  }

  /**
   * Get number of available RPCs
   */
  get count(): number {
    return this.urls.length;
  }

  /**
   * Rotate to the next RPC URL
   * @returns The new current URL
   */
  rotate(): string {
    this.currentIndex = (this.currentIndex + 1) % this.urls.length;
    return this.currentUrl;
  }

  /**
   * Execute a function with automatic RPC failover
   *
   * @param fn - Async function to execute
   * @param maxRetries - Maximum number of retries (default: number of RPCs)
   * @returns Result of the function
   */
  async withFailover<T>(
    fn: (url: string) => Promise<T>,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.urls.length;
    let lastError: Error | undefined;

    for (let i = 0; i < retries; i++) {
      try {
        return await fn(this.currentUrl);
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          this.rotate();
        }
      }
    }

    throw lastError || new Error('All RPC endpoints failed');
  }
}

// =============================================================================
// EVM-SPECIFIC RPC HELPERS
// =============================================================================

/**
 * Get RPC URL for a specific EVM network
 *
 * @param network - EVM network identifier (eth, bnb, poly)
 * @param getEnv - Function to get environment variable value
 * @returns RPC URL for the network
 */
export function getEvmRpcUrl(
  network: 'eth' | 'bnb' | 'poly',
  getEnv: (key: string) => string | undefined
): string {
  return getRpcUrl(network, getEnv);
}

/**
 * Get all RPC URLs for a specific EVM network
 *
 * @param network - EVM network identifier (eth, bnb, poly)
 * @param getEnv - Function to get environment variable value
 * @returns Array of RPC URLs for the network
 */
export function getEvmRpcUrls(
  network: 'eth' | 'bnb' | 'poly',
  getEnv: (key: string) => string | undefined
): string[] {
  return getRpcUrls(network, getEnv);
}
