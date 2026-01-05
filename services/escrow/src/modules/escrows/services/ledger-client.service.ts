import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceClient, ServiceRequestOptions } from '@escrowly/shared-config';
import { ILedgerClient } from './interfaces/ledger-client.interface';

/**
 * Ledger Client Service
 *
 * Single Responsibility: Makes HTTP calls to Ledger Service REST APIs
 * Follows Single Responsibility Principle (SRP)
 * Implements ILedgerClient interface (Dependency Inversion Principle)
 * 
 * Uses ServiceClient for resilient service-to-service communication with:
 * - Automatic retry with exponential backoff
 * - Circuit breaker pattern
 * - Request timeouts
 * - Request correlation IDs
 * 
 * IMPORTANT: This service ONLY makes synchronous REST API calls when Escrow
 * needs an immediate response. All other inter-service communication uses
 * Kafka events (fire-and-forget pattern).
 * 
 * Current usage:
 * - Balance checks: Escrow needs immediate response to validate before creating escrow
 * 
 * NOT used for:
 * - Reservations: Handled via Kafka events (escrow.payment.completed → Ledger reserves funds)
 * - Transfers: Handled via Kafka events (escrow.completed → Ledger releases funds)
 * - Releases: Handled via Kafka events (escrow.completed → Ledger releases funds)
 */
@Injectable()
export class LedgerClientService implements ILedgerClient {
  private readonly logger = new Logger(LedgerClientService.name);
  private readonly serviceClient: ServiceClient;

  constructor(private readonly configService: ConfigService) {
    const ledgerBaseUrl =
      this.configService.get<string>('LEDGER_SERVICE_URL') || 'http://localhost:3005';
    
    const serviceApiKey = this.configService.get<string>(
      'SERVICE_API_KEY',
      'default-service-key-change-in-production',
    );

    // Initialize service client with proper s2s configuration
    this.serviceClient = new ServiceClient({
      baseUrl: ledgerBaseUrl,
      serviceName: 'escrow-service',
      serviceApiKey,
      timeoutMs: this.configService.get<number>('LEDGER_SERVICE_TIMEOUT_MS', 10000), // Default 10s
      retry: {
        maxRetries: this.configService.get<number>('LEDGER_SERVICE_MAX_RETRIES', 3),
        initialDelayMs: this.configService.get<number>('LEDGER_SERVICE_RETRY_DELAY_MS', 100),
        maxDelayMs: this.configService.get<number>('LEDGER_SERVICE_MAX_RETRY_DELAY_MS', 2000),
        retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
      },
      circuitBreaker: {
        failureThreshold: this.configService.get<number>('LEDGER_SERVICE_CIRCUIT_FAILURE_THRESHOLD', 5),
        successThreshold: this.configService.get<number>('LEDGER_SERVICE_CIRCUIT_SUCCESS_THRESHOLD', 2),
        timeout: this.configService.get<number>('LEDGER_SERVICE_CIRCUIT_TIMEOUT_MS', 60000), // 1 minute
      },
    });

    this.logger.log(
      `LedgerClient initialized: ${ledgerBaseUrl} | Circuit breaker: ${this.serviceClient.getCircuitState()}`,
    );
  }

  /**
   * Check if user has sufficient balance
   * 
   * Uses ServiceClient for resilient communication with automatic retry,
   * circuit breaker, and timeout handling.
   */
  async checkBalance(
    userId: string,
    amount: number,
    asset: string = 'USDT',
    chain: string = 'eth',
    jwtToken?: string,
  ): Promise<{ sufficient: boolean; available: number; required: number }> {
    const headers: Record<string, string> = {};
    
    // Forward JWT token if provided
    if (jwtToken) {
      headers['Authorization'] = jwtToken;
      this.logger.debug(`Forwarding JWT token to Ledger service for balance check`);
    } else {
      this.logger.warn(`No JWT token provided - Ledger service may reject request`);
    }

    const requestOptions: ServiceRequestOptions = {
      method: 'POST',
      path: `/api/v1/ledger/users/${userId}/balance-check`,
      body: {
        amount,
        asset,
        chain,
      },
      headers,
    };

    try {
      return await this.serviceClient.request<{
        sufficient: boolean;
        available: number;
        required: number;
      }>(requestOptions);
    } catch (error: any) {
      // Log circuit breaker state if available
      const circuitState = this.serviceClient.getCircuitState();
      if (circuitState !== 'CLOSED') {
        this.logger.warn(
          `Circuit breaker state: ${circuitState} | Balance check failed for user ${userId}`,
        );
      }
      throw error;
    }
  }

  // NOTE: All other operations (reservations, transfers, releases) are handled
  // via Kafka events. Escrow service publishes events, Ledger service consumes them.
  // See: services/escrow/src/kafka/README.md for event flow documentation.
}

