/**
 * Chain Configuration for Wallet Service
 *
 * Re-exports chain configuration from @escrowly/chain-config package
 * with wallet-service specific types and utilities.
 */

// Re-export everything from the shared package
export {
  // Types
  type ListenerChainId,
  type WalletChainId,
  type EvmNetwork,
  type TokenConfig,
  type ChainMetadata,
  type FullChainConfig,
  // Chain configs
  CHAIN_CONFIGS,
  CHAIN_METADATA,
  getChainConfig,
  getChainMetadata,
  getSupportedListenerChains,
  getSupportedWalletChains,
  isValidListenerChainId,
  isValidWalletChainId,
  isEvmChain,
  getEvmChains,
  // Chain mapping
  mapListenerChainToWalletChain,
  mapWalletChainToListenerChain,
  getListenerChainsForWalletChain,
  // Tokens
  ETH_TOKENS,
  BNB_TOKENS,
  POLYGON_TOKENS,
  SOLANA_TOKENS,
  TRON_TOKENS,
  TOKENS_BY_CHAIN,
  getTokensForChain,
  getTokenConfig,
  getTokenAddress,
  isTokenSupported,
  // RPC
  getRpcUrls,
  getRpcUrl,
  getEvmRpcUrl,
  getEvmRpcUrls,
  RpcManager,
  // ABIs and topics
  ERC20_ABI,
  ERC20_TRANSFER_TOPIC,
  TRC20_TRANSFER_TOPIC,
  SOLANA_TOKEN_PROGRAM_ID,
  // Redis queues
  REDIS_QUEUE_NAMES,
  getAllRedisQueueNames,
} from '@escrowly/chain-config';

// =============================================================================
// WALLET-SERVICE SPECIFIC TOKEN ALIASES
// =============================================================================

import {
  ETH_TOKENS as _ETH_TOKENS,
  SOLANA_TOKENS as _SOL_TOKENS,
  TRON_TOKENS as _TRC_TOKENS,
} from '@escrowly/chain-config';

/**
 * EVM tokens (using ETH mainnet addresses as default)
 * @deprecated Use getTokensForChain('eth') or TOKENS_BY_CHAIN[chainId] instead
 */
export const EVM_TOKENS = _ETH_TOKENS;

/**
 * Solana tokens
 * @deprecated Use getTokensForChain('sol') or TOKENS_BY_CHAIN.sol instead
 */
export const SOL_TOKENS = _SOL_TOKENS;

/**
 * Tron tokens
 * @deprecated Use getTokensForChain('trc') or TOKENS_BY_CHAIN.trc instead
 */
export const TRC_TOKENS = _TRC_TOKENS;
