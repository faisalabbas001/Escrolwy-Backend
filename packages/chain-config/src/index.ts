/**
 * @escrowly/chain-config
 *
 * Centralized blockchain configuration for Escrowly services.
 *
 * This package provides:
 * - Token addresses for all supported chains
 * - RPC configuration with unified fallback system
 * - Chain metadata (block times, native currencies, etc.)
 * - Smart contract ABIs
 * - Utility functions for chain management
 *
 * @example
 * ```typescript
 * import {
 *   getChainConfig,
 *   getRpcUrls,
 *   getTokensForChain,
 *   ERC20_ABI,
 *   mapListenerChainToWalletChain,
 * } from '@escrowly/chain-config';
 *
 * // Get full chain config
 * const ethConfig = getChainConfig('eth');
 *
 * // Get RPC URLs with fallback
 * const rpcUrls = getRpcUrls('eth', (key) => process.env[key]);
 *
 * // Get tokens for a chain
 * const tokens = getTokensForChain('eth');
 *
 * // Map listener chain to wallet chain
 * const walletChain = mapListenerChainToWalletChain('eth'); // 'evm'
 * ```
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export * from './types';

// =============================================================================
// TOKEN EXPORTS
// =============================================================================

export {
  // Individual chain tokens
  ETH_TOKENS,
  BNB_TOKENS,
  POLYGON_TOKENS,
  SOLANA_TOKENS,
  TRON_TOKENS,
  // Aggregated
  TOKENS_BY_CHAIN,
  // Utility functions
  getTokensForChain,
  getTokenConfig,
  getTokenAddress,
  isTokenSupported,
  getAllSupportedTokenSymbols,
} from './tokens';

// =============================================================================
// RPC EXPORTS
// =============================================================================

export {
  // Environment variable keys
  RPC_ENV_KEYS,
  // Default endpoints
  DEFAULT_RPC_ENDPOINTS,
  // Configurations
  RPC_CONFIGS,
  // Utility functions
  getRpcUrls,
  getRpcUrl,
  createRpcProvider,
  rotateRpc,
  // EVM-specific helpers
  getEvmRpcUrl,
  getEvmRpcUrls,
  // RPC Manager class
  RpcManager,
} from './rpc';

// =============================================================================
// CHAIN EXPORTS
// =============================================================================

export {
  // Metadata
  CHAIN_METADATA,
  // Redis queues
  REDIS_QUEUE_NAMES,
  getAllRedisQueueNames,
  // Full configurations
  CHAIN_CONFIGS,
  // Utility functions
  getChainConfig,
  getChainMetadata,
  getSupportedListenerChains,
  getSupportedWalletChains,
  isValidListenerChainId,
  isValidWalletChainId,
  isEvmChain,
  getEvmChains,
  // Chain ID mapping
  mapListenerChainToWalletChain,
  mapWalletChainToListenerChain,
  getListenerChainsForWalletChain,
  // Polling
  getPollingInterval,
  WATCHDOG_INTERVAL_MS,
} from './chains';

// =============================================================================
// ABI EXPORTS
// =============================================================================

export {
  // ABIs
  ERC20_ABI,
  // Event topics
  ERC20_TRANSFER_TOPIC,
  ERC20_APPROVAL_TOPIC,
  TRC20_TRANSFER_TOPIC,
  // Solana program IDs
  SOLANA_TOKEN_PROGRAM_ID,
  SOLANA_ASSOCIATED_TOKEN_PROGRAM_ID,
  SOLANA_SYSTEM_PROGRAM_ID,
} from './abis';

// =============================================================================
// CONFIRMATION EXPORTS
// =============================================================================

export {
  // Confirmation configurations
  CHAIN_CONFIRMATIONS,
  // Utility functions
  getConfirmationConfig,
  getConfirmations,
  usesFinalizedCommitment,
  calculateSafeBlock,
} from './confirmations';

