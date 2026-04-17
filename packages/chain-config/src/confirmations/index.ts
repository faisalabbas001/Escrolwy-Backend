/**
 * Chain Confirmation Configuration
 *
 * Defines block confirmation requirements for each supported chain.
 * These confirmations protect against chain reorganizations and
 * ensure only finalized transactions are processed.
 */

import { ListenerChainId, ChainConfirmationConfig } from '../types';

/**
 * Default confirmation requirements per chain
 *
 * These values are chosen based on:
 * - Chain block times
 * - Historical reorg depths
 * - Industry best practices
 *
 * ETH: 7 blocks (~84 seconds) - covers most reorgs
 * BNB: 12 blocks (~36 seconds) - BSC has faster finality
 * POLY: 40 blocks (~80 seconds) - Polygon recommends higher confirmations
 * SOL: Uses finalized commitment (no block buffer needed)
 * TRC: 20 blocks (~60 seconds) - Tron's recommended confirmation depth
 */
export const CHAIN_CONFIRMATIONS: Record<
  ListenerChainId,
  ChainConfirmationConfig
> = {
  eth: {
    chainId: 'eth',
    confirmations: 7,
    useFinalizedCommitment: false,
  },
  bnb: {
    chainId: 'bnb',
    confirmations: 12,
    useFinalizedCommitment: false,
  },
  poly: {
    chainId: 'poly',
    confirmations: 40,
    useFinalizedCommitment: false,
  },
  sol: {
    chainId: 'sol',
    confirmations: 0,
    useFinalizedCommitment: true,
  },
  trc: {
    chainId: 'trc',
    confirmations: 20,
    useFinalizedCommitment: false,
  },
};

/**
 * Get confirmation configuration for a chain
 */
export function getConfirmationConfig(
  chainId: ListenerChainId
): ChainConfirmationConfig {
  const config = CHAIN_CONFIRMATIONS[chainId];
  if (!config) {
    throw new Error(`Unknown chain: ${chainId}`);
  }
  return config;
}

/**
 * Get the number of confirmations required for a chain
 */
export function getConfirmations(chainId: ListenerChainId): number {
  return getConfirmationConfig(chainId).confirmations;
}

/**
 * Check if a chain uses finalized commitment (vs block confirmations)
 */
export function usesFinalizedCommitment(chainId: ListenerChainId): boolean {
  return getConfirmationConfig(chainId).useFinalizedCommitment;
}

/**
 * Calculate the safe block height given current block and chain confirmations
 * Returns the highest block number that is considered confirmed/safe
 */
export function calculateSafeBlock(
  chainId: ListenerChainId,
  currentBlock: number
): number {
  const confirmations = getConfirmations(chainId);
  return Math.max(0, currentBlock - confirmations);
}
