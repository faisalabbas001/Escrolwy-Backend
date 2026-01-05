/**
 * Injection token for ILedgerClient
 * Required because NestJS cannot inject interfaces directly
 */
export const LEDGER_CLIENT_TOKEN = Symbol('ILedgerClient');

/**
 * Ledger Client Interface
 *
 * Defines contract for Ledger Service REST API calls
 * Follows Dependency Inversion Principle (DIP)
 * 
 * IMPORTANT: Only synchronous operations that require immediate response are here.
 * All other inter-service communication uses Kafka events (fire-and-forget).
 * 
 * REST APIs are ONLY used when Escrow service needs an immediate response
 * to proceed with its workflow (e.g., balance validation before creating escrow).
 * 
 * All other operations (reservations, transfers, releases) are handled via Kafka events:
 * - escrow.payment.completed → Ledger reserves funds
 * - escrow.completed → Ledger releases funds
 * - escrow.cancelled → Ledger refunds funds
 * - escrow.disputed → Ledger freezes funds
 */
export interface ILedgerClient {
  /**
   * Check if user has sufficient balance
   * 
   * SYNCHRONOUS: Escrow service needs immediate response to validate before creating escrow.
   * This is the ONLY REST API call Escrow service makes to Ledger.
   * All other communication is via Kafka events (fire-and-forget).
   * 
   * @param jwtToken - Optional JWT token to forward to Ledger service for authentication
   */
  checkBalance(
    userId: string,
    amount: number,
    asset?: string,
    chain?: string,
    jwtToken?: string,
  ): Promise<{ sufficient: boolean; available: number; required: number }>;
}

