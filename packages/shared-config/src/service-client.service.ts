import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Circuit Breaker State
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes to close circuit (half-open -> closed)
  timeout: number; // Time in ms before attempting half-open
}

/**
 * Retry Configuration
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[]; // HTTP status codes to retry
}

/**
 * Service Client Configuration
 */
export interface ServiceClientConfig {
  baseUrl: string;
  serviceName: string; // Name of the calling service (e.g., 'escrow-service')
  serviceApiKey: string;
  timeoutMs?: number; // Request timeout in milliseconds
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
}

/**
 * Request Options
 */
export interface ServiceRequestOptions {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
  timeoutMs?: number; // Override default timeout for this request
  skipRetry?: boolean; // Skip retry for this request
}

/**
 * Base Service Client
 *
 * Provides resilient HTTP client for service-to-service communication with:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Request timeouts
 * - Request correlation IDs
 * - Proper error handling
 *
 * Usage:
 * ```typescript
 * const client = new ServiceClient({
 *   baseUrl: 'http://ledger-service:3005',
 *   serviceName: 'escrow-service',
 *   serviceApiKey: 'your-api-key',
 *   timeoutMs: 5000,
 *   retry: {
 *     maxRetries: 3,
 *     initialDelayMs: 100,
 *     maxDelayMs: 2000,
 *     retryableStatusCodes: [408, 429, 500, 502, 503, 504],
 *   },
 *   circuitBreaker: {
 *     failureThreshold: 5,
 *     successThreshold: 2,
 *     timeout: 60000, // 1 minute
 *   },
 * });
 *
 * const result = await client.request('POST', '/v1/users/123/balance-check', { amount: 100 });
 * ```
 */
@Injectable()
export class ServiceClient {
  private readonly logger = new Logger(ServiceClient.name);
  private readonly config: ServiceClientConfig;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 2000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  };
  private readonly defaultCircuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  };

  constructor(config: ServiceClientConfig) {
    this.config = {
      timeoutMs: 10000, // Default 10 seconds
      retry: config.retry || this.defaultRetryConfig,
      circuitBreaker: config.circuitBreaker || this.defaultCircuitBreakerConfig,
      ...config,
    };
  }

  /**
   * Make HTTP request with retry, circuit breaker, and timeout
   */
  async request<T>(options: ServiceRequestOptions): Promise<T> {
    const requestId = this.generateRequestId();
    const {
      method,
      path,
      body,
      headers = {},
      timeoutMs = this.config.timeoutMs,
      skipRetry = false,
    } = options;

    // Check circuit breaker
    if (this.circuitState === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.config.circuitBreaker!.timeout) {
        // Transition to half-open
        this.logger.warn(
          `[${requestId}] Circuit breaker transitioning to HALF_OPEN after ${timeSinceLastFailure}ms`,
        );
        this.circuitState = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        // Circuit is open, reject immediately
        this.logger.error(
          `[${requestId}] Circuit breaker is OPEN, rejecting request to ${path}`,
        );
        throw new HttpException(
          'Service temporarily unavailable (circuit breaker open)',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Service-Api-Key': this.config.serviceApiKey,
      'X-Service-Id': this.config.serviceName,
      'X-Request-Id': requestId,
      'X-Correlation-Id': requestId, // For tracing across services
      ...headers,
    };

    // Prepare request
    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Log request
    this.logger.log(
      `[${requestId}] → ${method} ${url}${body ? ` | Body: ${JSON.stringify(body)}` : ''}`,
    );

    // Execute with retry logic
    const maxAttempts = skipRetry ? 1 : (this.config.retry!.maxRetries + 1);
    let lastError: Error | HttpException | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Create timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs!);

        try {
          const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Handle response
          const contentType = response.headers.get('content-type');
          let data: any;

          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }

          if (!response.ok) {
            const error = new HttpException(
              data.message || `HTTP ${response.status}: ${response.statusText}`,
              response.status,
            );

            // Check if we should retry
            if (
              !skipRetry &&
              attempt < maxAttempts &&
              this.config.retry!.retryableStatusCodes.includes(response.status)
            ) {
              const delay = this.calculateRetryDelay(attempt);
              this.logger.warn(
                `[${requestId}] Attempt ${attempt}/${maxAttempts} failed with ${response.status}, retrying in ${delay}ms`,
              );
              await this.delay(delay);
              lastError = error;
              continue;
            }

            // Don't retry, throw error
            this.recordFailure();
            this.logger.error(
              `[${requestId}] ❌ Request failed: ${response.status} ${data.message || response.statusText}`,
            );
            throw error;
          }

          // Success!
          this.recordSuccess();
          this.logger.log(
            `[${requestId}] ✅ Success (${response.status})${attempt > 1 ? ` after ${attempt} attempts` : ''}`,
          );
          return data as T;
        } catch (fetchError: any) {
          clearTimeout(timeoutId);

          // Handle timeout
          if (fetchError.name === 'AbortError') {
            const error = new HttpException(
              `Request timeout after ${timeoutMs}ms`,
              HttpStatus.REQUEST_TIMEOUT,
            );

            if (!skipRetry && attempt < maxAttempts) {
              const delay = this.calculateRetryDelay(attempt);
              this.logger.warn(
                `[${requestId}] Attempt ${attempt}/${maxAttempts} timed out, retrying in ${delay}ms`,
              );
              await this.delay(delay);
              lastError = error;
              continue;
            }

            this.recordFailure();
            this.logger.error(`[${requestId}] ❌ Request timeout after ${timeoutMs}ms`);
            throw error;
          }

          // Handle network errors
          if (!skipRetry && attempt < maxAttempts) {
            const delay = this.calculateRetryDelay(attempt);
            this.logger.warn(
              `[${requestId}] Attempt ${attempt}/${maxAttempts} failed with network error: ${fetchError.message}, retrying in ${delay}ms`,
            );
            await this.delay(delay);
            lastError = fetchError;
            continue;
          }

          // Don't retry, throw error
          this.recordFailure();
          this.logger.error(
            `[${requestId}] ❌ Network error: ${fetchError.message}`,
          );
          throw new HttpException(
            `Failed to communicate with service: ${fetchError.message}`,
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
      } catch (error: any) {
        // If it's an HttpException, don't retry (already handled above)
        if (error instanceof HttpException) {
          throw error;
        }

        // Unexpected error
        if (attempt < maxAttempts && !skipRetry) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.warn(
            `[${requestId}] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`,
          );
          await this.delay(delay);
          lastError = error;
          continue;
        }

        this.recordFailure();
        this.logger.error(`[${requestId}] ❌ Request failed: ${error.message}`);
        throw new HttpException(
          `Service request failed: ${error.message}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    // Should never reach here, but TypeScript needs it
    if (lastError) {
      throw lastError;
    }

    throw new HttpException(
      'Request failed after all retries',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Record successful request (for circuit breaker)
   */
  private recordSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.circuitBreaker!.successThreshold) {
        this.logger.log(
          `Circuit breaker transitioning to CLOSED after ${this.successCount} successful requests`,
        );
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record failed request (for circuit breaker)
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Failed in half-open, go back to open
      this.logger.error('Circuit breaker transitioning back to OPEN after failure in HALF_OPEN');
      this.circuitState = CircuitState.OPEN;
      this.successCount = 0;
    } else if (
      this.circuitState === CircuitState.CLOSED &&
      this.failureCount >= this.config.circuitBreaker!.failureThreshold
    ) {
      // Too many failures, open circuit
      this.logger.error(
        `Circuit breaker opening after ${this.failureCount} failures`,
      );
      this.circuitState = CircuitState.OPEN;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.config.retry!.initialDelayMs * Math.pow(2, attempt - 1),
      this.config.retry!.maxDelayMs,
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
    return Math.floor(delay + jitter);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current circuit breaker state (for monitoring)
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Reset circuit breaker (for testing/manual recovery)
   */
  resetCircuitBreaker(): void {
    this.logger.log('Circuit breaker manually reset');
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

