import { ChainId, ChainConfig } from '../../config';

/**
 * Listener Mode
 */
export type ListenerMode = 'replay' | 'realtime' | 'stopped';

/**
 * Listener Status
 */
export interface ListenerStatus {
  chain: ChainId;
  mode: ListenerMode;
  lastProcessedBlock: number;
  currentChainBlock: number;
  /** Safe block height (currentChainBlock - confirmations) */
  safeBlock: number;
  /** Number of block confirmations required */
  confirmations: number;
  /** Blocks behind the chain tip (currentChainBlock - lastProcessedBlock) */
  lag: number;
  /** Whether using finalized commitment (Solana) */
  useFinalizedCommitment: boolean;
  isRunning: boolean;
  startedAt: Date | null;
  eventsProcessed: number;
}

/**
 * Chain Listener Interface
 *
 * All chain-specific listeners must implement this interface.
 * Provides a common contract for starting, stopping, and monitoring listeners.
 */
export interface IChainListener {
  /**
   * Chain configuration
   */
  readonly chainConfig: ChainConfig;

  /**
   * Start the listener
   * - Reads last processed block from DB
   * - Replays missed blocks if behind
   * - Switches to real-time mode when caught up
   */
  start(): Promise<void>;

  /**
   * Stop the listener gracefully
   */
  stop(): Promise<void>;

  /**
   * Get current listener status
   */
  getStatus(): Promise<ListenerStatus>;

  /**
   * Get the current block height from the blockchain RPC
   */
  getCurrentBlockHeight(): Promise<number>;

  /**
   * Process a specific block and extract transfer events
   */
  processBlock(blockNumber: number): Promise<number>;
}

