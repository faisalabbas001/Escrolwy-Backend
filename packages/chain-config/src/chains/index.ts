/**
 * Chain Metadata Configuration
 *
 * Contains chain-specific metadata like block times, native currencies,
 * and explorer URLs for all supported chains.
 */

import {
  ListenerChainId,
  WalletChainId,
  ChainMetadata,
  FullChainConfig,
} from '../types';
import { TOKENS_BY_CHAIN } from '../tokens';
import { RPC_CONFIGS } from '../rpc';
import { CHAIN_CONFIRMATIONS } from '../confirmations';

// =============================================================================
// CHAIN METADATA
// =============================================================================

export const CHAIN_METADATA: Record<ListenerChainId, ChainMetadata> = {
  eth: {
    chainId: 'eth',
    name: 'Ethereum',
    type: 'evm',
    isEvm: true,
    blockTimeMs: 12000, // ~12 seconds
    nativeCurrency: 'ETH',
    nativeDecimals: 18,
    explorerUrl: 'https://etherscan.io',
  },
  bnb: {
    chainId: 'bnb',
    name: 'BNB Smart Chain',
    type: 'evm',
    isEvm: true,
    blockTimeMs: 3000, // ~3 seconds
    nativeCurrency: 'BNB',
    nativeDecimals: 18,
    explorerUrl: 'https://bscscan.com',
  },
  poly: {
    chainId: 'poly',
    name: 'Polygon',
    type: 'evm',
    isEvm: true,
    blockTimeMs: 2000, // ~2 seconds
    nativeCurrency: 'MATIC',
    nativeDecimals: 18,
    explorerUrl: 'https://polygonscan.com',
  },
  sol: {
    chainId: 'sol',
    name: 'Solana',
    type: 'solana',
    isEvm: false,
    blockTimeMs: 400, // ~400ms slot time
    nativeCurrency: 'SOL',
    nativeDecimals: 9,
    explorerUrl: 'https://explorer.solana.com',
  },
  trc: {
    chainId: 'trc',
    name: 'Tron',
    type: 'tron',
    isEvm: false,
    blockTimeMs: 3000, // ~3 seconds
    nativeCurrency: 'TRX',
    nativeDecimals: 6,
    explorerUrl: 'https://tronscan.org',
  },
};

// =============================================================================
// REDIS QUEUE NAMES
// =============================================================================

export const REDIS_QUEUE_NAMES: Record<ListenerChainId, string> = {
  eth: 'raw_events_eth',
  bnb: 'raw_events_bnb',
  poly: 'raw_events_poly',
  sol: 'raw_events_sol',
  trc: 'raw_events_trc',
};

/**
 * Get all Redis queue names as an array
 */
export function getAllRedisQueueNames(): string[] {
  return Object.values(REDIS_QUEUE_NAMES);
}

// =============================================================================
// FULL CHAIN CONFIGURATIONS
// =============================================================================

/**
 * Full chain configurations combining metadata, RPC config, tokens, and confirmations
 */
export const CHAIN_CONFIGS: Record<ListenerChainId, FullChainConfig> = {
  eth: {
    metadata: CHAIN_METADATA.eth,
    rpc: RPC_CONFIGS.eth,
    tokens: TOKENS_BY_CHAIN.eth,
    queueName: REDIS_QUEUE_NAMES.eth,
    confirmations: CHAIN_CONFIRMATIONS.eth,
  },
  bnb: {
    metadata: CHAIN_METADATA.bnb,
    rpc: RPC_CONFIGS.bnb,
    tokens: TOKENS_BY_CHAIN.bnb,
    queueName: REDIS_QUEUE_NAMES.bnb,
    confirmations: CHAIN_CONFIRMATIONS.bnb,
  },
  poly: {
    metadata: CHAIN_METADATA.poly,
    rpc: RPC_CONFIGS.poly,
    tokens: TOKENS_BY_CHAIN.poly,
    queueName: REDIS_QUEUE_NAMES.poly,
    confirmations: CHAIN_CONFIRMATIONS.poly,
  },
  sol: {
    metadata: CHAIN_METADATA.sol,
    rpc: RPC_CONFIGS.sol,
    tokens: TOKENS_BY_CHAIN.sol,
    queueName: REDIS_QUEUE_NAMES.sol,
    confirmations: CHAIN_CONFIRMATIONS.sol,
  },
  trc: {
    metadata: CHAIN_METADATA.trc,
    rpc: RPC_CONFIGS.trc,
    tokens: TOKENS_BY_CHAIN.trc,
    queueName: REDIS_QUEUE_NAMES.trc,
    confirmations: CHAIN_CONFIRMATIONS.trc,
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: ListenerChainId): FullChainConfig {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unknown chain: ${chainId}`);
  }
  return config;
}

/**
 * Get chain metadata by chain ID
 */
export function getChainMetadata(chainId: ListenerChainId): ChainMetadata {
  const metadata = CHAIN_METADATA[chainId];
  if (!metadata) {
    throw new Error(`Unknown chain: ${chainId}`);
  }
  return metadata;
}

/**
 * Get all supported listener chain IDs
 */
export function getSupportedListenerChains(): ListenerChainId[] {
  return Object.keys(CHAIN_CONFIGS) as ListenerChainId[];
}

/**
 * Get all supported wallet chain IDs
 */
export function getSupportedWalletChains(): WalletChainId[] {
  return ['evm', 'sol', 'trc'];
}

/**
 * Validate if a string is a valid listener chain ID
 */
export function isValidListenerChainId(
  chain: string
): chain is ListenerChainId {
  return chain in CHAIN_CONFIGS;
}

/**
 * Validate if a string is a valid wallet chain ID
 */
export function isValidWalletChainId(chain: string): chain is WalletChainId {
  return ['evm', 'sol', 'trc'].includes(chain);
}

/**
 * Check if a chain is EVM-compatible
 */
export function isEvmChain(chainId: ListenerChainId): boolean {
  return CHAIN_METADATA[chainId]?.isEvm ?? false;
}

/**
 * Get all EVM chain IDs
 */
export function getEvmChains(): ListenerChainId[] {
  return getSupportedListenerChains().filter((c) => isEvmChain(c));
}

// =============================================================================
// CHAIN ID MAPPING
// =============================================================================

/**
 * Map listener chain IDs (eth, bnb, poly, sol, trc) to wallet chain IDs (evm, sol, trc)
 */
export function mapListenerChainToWalletChain(
  listenerChain: string
): WalletChainId {
  switch (listenerChain) {
    case 'eth':
    case 'bnb':
    case 'poly':
      return 'evm';
    case 'sol':
      return 'sol';
    case 'trc':
      return 'trc';
    default:
      throw new Error(`Unknown listener chain: ${listenerChain}`);
  }
}

/**
 * Map wallet chain ID to default listener chain ID
 * (For EVM, defaults to 'eth')
 */
export function mapWalletChainToListenerChain(
  walletChain: WalletChainId
): ListenerChainId {
  switch (walletChain) {
    case 'evm':
      return 'eth'; // Default EVM chain
    case 'sol':
      return 'sol';
    case 'trc':
      return 'trc';
    default:
      throw new Error(`Unknown wallet chain: ${walletChain}`);
  }
}

/**
 * Get all listener chains for a wallet chain
 */
export function getListenerChainsForWalletChain(
  walletChain: WalletChainId
): ListenerChainId[] {
  switch (walletChain) {
    case 'evm':
      return ['eth', 'bnb', 'poly'];
    case 'sol':
      return ['sol'];
    case 'trc':
      return ['trc'];
    default:
      throw new Error(`Unknown wallet chain: ${walletChain}`);
  }
}

// =============================================================================
// POLLING INTERVALS
// =============================================================================

/**
 * Get recommended polling interval for a chain (with buffer)
 */
export function getPollingInterval(chainId: ListenerChainId): number {
  const metadata = CHAIN_METADATA[chainId];
  if (!metadata) {
    return 5000; // Default 5 seconds
  }

  // Add 25% buffer to block time for polling
  return Math.ceil(metadata.blockTimeMs * 1.25);
}

/**
 * Watchdog interval for health checks (30 seconds)
 */
export const WATCHDOG_INTERVAL_MS = 30000;
