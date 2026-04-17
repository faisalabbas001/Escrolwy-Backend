/**
 * Chain Configuration for Listener Engine
 *
 * Re-exports chain configuration from @escrowly/chain-config package
 * with listener-engine specific types and utilities.
 */

// Re-export everything from the shared package
export {
  // Types
  type ListenerChainId as ChainId,
  type TokenConfig,
  type ChainMetadata,
  type FullChainConfig as ChainConfig,
  // Chain configs
  CHAIN_CONFIGS,
  CHAIN_METADATA,
  getChainConfig,
  getChainMetadata,
  getSupportedListenerChains as getSupportedChains,
  isValidListenerChainId as isValidChainId,
  isEvmChain,
  getEvmChains,
  // Tokens
  TOKENS_BY_CHAIN,
  getTokensForChain,
  getTokenConfig,
  getTokenAddress,
  // RPC
  getRpcUrls,
  getRpcUrl,
  RpcManager,
  // ABIs and topics
  ERC20_TRANSFER_TOPIC,
  TRC20_TRANSFER_TOPIC,
  ERC20_ABI,
  // Redis queues
  REDIS_QUEUE_NAMES,
  getAllRedisQueueNames,
  // Polling
  getPollingInterval,
  WATCHDOG_INTERVAL_MS as watchDogInterval,
} from '@escrowly/chain-config';

// =============================================================================
// LISTENER-ENGINE SPECIFIC ALIASES
// =============================================================================

// For backwards compatibility, re-export with old names
import {
  CHAIN_CONFIGS as _CHAIN_CONFIGS,
  type ListenerChainId,
  type FullChainConfig,
} from '@escrowly/chain-config';

/**
 * Get chain configuration by chain ID (backwards compatible)
 * @deprecated Use getChainConfig from @escrowly/chain-config instead
 */
export function getChainConfigLegacy(chainId: ListenerChainId): FullChainConfig {
  const config = _CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unknown chain: ${chainId}`);
  }
  return config;
}
