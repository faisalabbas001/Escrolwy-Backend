import { ChainId } from '../../config';

/**
 * Raw Transfer Event DTO
 *
 * Represents a raw blockchain transfer event that will be pushed to Redis.
 * This is the standard format for all chains (EVM, Solana, Tron).
 *
 * The Worker service will consume these events from Redis queues.
 */
export interface RawTransferEvent {
  /**
   * Chain identifier
   */
  chain: ChainId;

  /**
   * Block number where the transfer occurred
   */
  blockNumber: number;

  /**
   * Transaction hash
   */
  txHash: string;

  /**
   * Log index within the transaction (for EVM chains)
   * For Solana/Tron, this may be instruction index or similar
   */
  logIndex: number;

  /**
   * Sender address
   */
  from: string;

  /**
   * Recipient address
   */
  to: string;

  /**
   * Transfer amount as raw string (no decimal conversion)
   * Preserves full precision for large numbers
   */
  amount: string;

  /**
   * Token symbol (USDT, USDC, DAI)
   */
  tokenSymbol: string;

  /**
   * Token contract address
   */
  tokenAddress: string;

  /**
   * Block timestamp (Unix timestamp in seconds)
   */
  timestamp: number;
}

/**
 * Create a RawTransferEvent object
 */
export function createRawTransferEvent(
  chain: ChainId,
  blockNumber: number,
  txHash: string,
  logIndex: number,
  from: string,
  to: string,
  amount: string,
  tokenSymbol: string,
  tokenAddress: string,
  timestamp: number,
): RawTransferEvent {
  return {
    chain,
    blockNumber,
    txHash,
    logIndex,
    from,
    to,
    amount,
    tokenSymbol,
    tokenAddress,
    timestamp,
  };
}

