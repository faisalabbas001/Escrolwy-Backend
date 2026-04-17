/**
 * Token Addresses Configuration
 *
 * Centralized token contract addresses for all supported chains.
 *
 * CURRENT: TESTNET CONFIGURATION
 * - ETH: Holesky testnet
 * - BNB: BSC Testnet
 * - POLY: Polygon Amoy Testnet
 * - SOL: Solana Devnet
 * - TRC: Tron Nile Testnet
 */

import { TokenConfig, ListenerChainId } from '../types';

// =============================================================================
// ETHEREUM HOLESKY TESTNET TOKENS
// =============================================================================

export const ETH_TOKENS: TokenConfig[] = [
  {
    symbol: 'USDT',
    address: '0x62bB5dEf7CE12e7d05E1503F66364A8be1CC07B7', // Holesky testnet
    decimals: 6,
  },
  {
    symbol: 'USDC',
    address: '0xdCF6A4BBfa21Ee3731Ae198B792978f542bA9cfB', // Holesky testnet
    decimals: 6,
  },
  {
    symbol: 'DAI',
    address: '0xA7d0BF4F1c5C6639Ce6b66d5865A1E70c90684bb', // Holesky testnet
    decimals: 6,
  },
];

// =============================================================================
// BNB SMART CHAIN TESTNET TOKENS
// TODO: Deploy testnet tokens or use existing BSC testnet contracts
// =============================================================================

export const BNB_TOKENS: TokenConfig[] = [
  {
    symbol: 'USDT',
    address: '0xA7d0BF4F1c5C6639Ce6b66d5865A1E70c90684bb', // TODO: Add BSC testnet USDT address
    decimals: 18,
  },
  // Note: Add more tokens when testnet contracts are deployed
];

// =============================================================================
// POLYGON AMOY TESTNET TOKENS
// TODO: Deploy testnet tokens or use existing Amoy testnet contracts
// =============================================================================

export const POLYGON_TOKENS: TokenConfig[] = [
  {
    symbol: 'USDT',
    address: '0xA7d0BF4F1c5C6639Ce6b66d5865A1E70c90684bb', // TODO: Add Polygon Amoy testnet USDT address
    decimals: 6,
  },
  // Note: Add more tokens when testnet contracts are deployed
];

// =============================================================================
// MAINNET TOKEN ADDRESSES (For Production - Replace above when ready)
// =============================================================================
// export const ETH_TOKENS: TokenConfig[] = [
//   { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
//   { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
//   { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EespocdFCAab6238', decimals: 18 },
// ];
// export const BNB_TOKENS: TokenConfig[] = [
//   { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
//   { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
//   { symbol: 'DAI', address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', decimals: 18 },
// ];
// export const POLYGON_TOKENS: TokenConfig[] = [
//   { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
//   { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
//   { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
// ];

// =============================================================================
// SOLANA DEVNET TOKENS (SPL Token Mints)
// =============================================================================

export const SOLANA_TOKENS: TokenConfig[] = [
  {
    symbol: 'USDT',
    address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet
    decimals: 6,
  },
  // Note: USDC and DAI mints below are mainnet - will show 0 on devnet
  // TODO: Add devnet token mints when deployed
];

// =============================================================================
// TRON NILE TESTNET TOKENS (TRC20)
// =============================================================================

export const TRON_TOKENS: TokenConfig[] = [
  {
    symbol: 'USDT',
    address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', // Nile testnet
    decimals: 6,
  },
  // Note: USDC and DAI not available on Nile testnet
];

// =============================================================================
// AGGREGATED TOKEN CONFIGS
// =============================================================================

/**
 * All tokens by chain ID
 */
export const TOKENS_BY_CHAIN: Record<ListenerChainId, TokenConfig[]> = {
  eth: ETH_TOKENS,
  bnb: BNB_TOKENS,
  poly: POLYGON_TOKENS,
  sol: SOLANA_TOKENS,
  trc: TRON_TOKENS,
};

/**
 * Get tokens for a specific chain
 */
export function getTokensForChain(chainId: ListenerChainId): TokenConfig[] {
  return TOKENS_BY_CHAIN[chainId] || [];
}

/**
 * Get a specific token config by chain and symbol
 */
export function getTokenConfig(
  chainId: ListenerChainId,
  symbol: string
): TokenConfig | undefined {
  const tokens = TOKENS_BY_CHAIN[chainId];
  return tokens?.find((t) => t.symbol === symbol);
}

/**
 * Get token address by chain and symbol
 */
export function getTokenAddress(
  chainId: ListenerChainId,
  symbol: string
): string | undefined {
  return getTokenConfig(chainId, symbol)?.address;
}

/**
 * Check if a token is supported on a chain
 */
export function isTokenSupported(
  chainId: ListenerChainId,
  symbol: string
): boolean {
  return getTokenConfig(chainId, symbol) !== undefined;
}

/**
 * Get all supported token symbols across all chains
 */
export function getAllSupportedTokenSymbols(): string[] {
  const symbols = new Set<string>();
  Object.values(TOKENS_BY_CHAIN).forEach((tokens) => {
    tokens.forEach((t) => symbols.add(t.symbol));
  });
  return Array.from(symbols);
}
