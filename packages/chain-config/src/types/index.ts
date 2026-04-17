/**
 * Chain Configuration Types
 *
 * Shared type definitions for blockchain configuration across all services.
 */

/**
 * Listener chain IDs - granular chain identifiers used by listener-engine
 */
export type ListenerChainId = 'eth' | 'bnb' | 'poly' | 'sol' | 'trc';

/**
 * Wallet chain IDs - grouped chain identifiers used by wallet service
 * EVM chains (eth, bnb, poly) are grouped under 'evm'
 */
export type WalletChainId = 'evm' | 'sol' | 'trc';

/**
 * EVM network identifiers
 */
export type EvmNetwork = 'eth' | 'bnb' | 'poly';

/**
 * All supported chain types
 */
export type ChainType = 'evm' | 'solana' | 'tron';

/**
 * Token configuration
 */
export interface TokenConfig {
  /** Token symbol (e.g., 'USDT', 'USDC') */
  symbol: string;
  /** Contract address */
  address: string;
  /** Token decimals */
  decimals: number;
}

/**
 * Chain metadata configuration
 */
export interface ChainMetadata {
  /** Chain identifier */
  chainId: ListenerChainId;
  /** Human-readable chain name */
  name: string;
  /** Chain type */
  type: ChainType;
  /** Whether this is an EVM-compatible chain */
  isEvm: boolean;
  /** Average block time in milliseconds */
  blockTimeMs: number;
  /** Native currency symbol */
  nativeCurrency: string;
  /** Native currency decimals */
  nativeDecimals: number;
  /** Block explorer URL */
  explorerUrl: string;
}

/**
 * RPC configuration for a single endpoint
 */
export interface RpcEndpoint {
  /** RPC URL */
  url: string;
  /** Weight for load balancing (higher = more preferred) */
  weight?: number;
  /** Whether this is a primary endpoint */
  isPrimary?: boolean;
}

/**
 * RPC configuration for a chain
 */
export interface ChainRpcConfig {
  /** Chain identifier */
  chainId: ListenerChainId;
  /** Environment variable key for single RPC URL */
  envKey: string;
  /** Environment variable key for multiple RPC URLs (comma-separated) */
  envKeyPlural: string;
  /** Default public RPC endpoints (fallback) */
  defaultEndpoints: string[];
}

/**
 * Configuration for chain confirmations/finality
 */
export interface ChainConfirmationConfig {
  /** Chain identifier */
  chainId: ListenerChainId;
  /** Number of block confirmations required (0 for chains using finalized commitment) */
  confirmations: number;
  /** Whether to use finalized commitment level (Solana-specific) */
  useFinalizedCommitment: boolean;
}

/**
 * Full chain configuration combining all aspects
 */
export interface FullChainConfig {
  metadata: ChainMetadata;
  rpc: ChainRpcConfig;
  tokens: TokenConfig[];
  /** Redis queue name for raw events */
  queueName: string;
  /** Block confirmation/finality configuration */
  confirmations: ChainConfirmationConfig;
}

/**
 * RPC provider with failover support
 */
export interface RpcProviderConfig {
  /** Current active RPC URL */
  currentUrl: string;
  /** All available RPC URLs */
  urls: string[];
  /** Current index in the URL list */
  currentIndex: number;
}

