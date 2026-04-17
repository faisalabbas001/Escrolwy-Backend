import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { IS_SERVICE_ONLY_KEY } from '../guards/service-auth.guard';

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * S2S Token Interceptor
 *
 * Automatically issues and caches JWT tokens for service-only endpoints.
 * IMPORTANT: Only issues S2S token if the calling service has a valid JWT token (authenticated user).
 * 
 * Flow:
 * 1. Checks if endpoint is marked as @ServiceOnly()
 * 2. Checks if request has a JWT token (authenticated user)
 * 3. If JWT exists → Calls auth service to get an S2S token
 * 4. Caches the token with TTL
 * 5. Adds the S2S token to the request Authorization header
 * 
 * If no JWT token exists, the interceptor does nothing and lets the guard handle authentication.
 */
@Injectable()
export class S2STokenInterceptor implements NestInterceptor {
  private readonly logger = new Logger(S2STokenInterceptor.name);
  private tokenCache = new Map<string, CachedToken>();
  private readonly authServiceUrl: string;
  private readonly serviceToken: string;
  private readonly serviceName: string;
  private readonly defaultScopes: string[];
  private readonly defaultTtl: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.authServiceUrl =
      this.configService.get<string>('AUTH_SERVICE_URL') ||
      'http://localhost:3000';
    this.serviceToken =
      this.configService.get<string>('SERVICE_TO_SERVICE_TOKEN') || '';
    this.serviceName =
      this.configService.get<string>('SERVICE_NAME') || 'unknown-service';
    this.defaultScopes =
      this.configService.get<string[]>('S2S_DEFAULT_SCOPES') || [
        'read:data',
        'write:data',
      ];
    this.defaultTtl = this.configService.get<number>('S2S_TOKEN_TTL', 600);
    this.timeoutMs = this.configService.get<number>('AUTH_SERVICE_TIMEOUT_MS', 5000);

    this.logger.log(
      `S2S Token Interceptor initialized for ${this.serviceName} | Auth service: ${this.authServiceUrl}`,
    );
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Check if endpoint is marked as service-only
    const isServiceOnly = this.reflector.getAllAndOverride<boolean>(
      IS_SERVICE_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isServiceOnly) {
      // Not a service-only endpoint, proceed normally
      return next.handle();
    }

    // Check if JWT token exists (authenticated user)
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    const hasJwtToken = authHeader && authHeader.startsWith('Bearer ');

    if (!hasJwtToken) {
      // No JWT token - don't issue S2S token
      // Let the guard handle authentication failure
      this.logger.debug(
        `No JWT token found for service-only endpoint: ${request.url}. Skipping S2S token issuance.`,
      );
      return next.handle();
    }

    // JWT token exists - extract it to verify it's valid
    const jwtToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token is valid before issuing S2S token
    if (!this.isValidJwtToken(jwtToken)) {
      this.logger.warn(
        `Invalid JWT token provided for service-only endpoint: ${request.url}. Skipping S2S token issuance.`,
      );
      return next.handle();
    }

    // JWT token is valid - issue S2S token
    try {
      const s2sToken = await this.getOrIssueToken();
      if (s2sToken) {
        // Replace user JWT with S2S token for service-to-service communication
        request.headers['authorization'] = `Bearer ${s2sToken}`;
        // Store original user JWT in custom header for reference if needed
        request.headers['x-user-token'] = jwtToken;
        this.logger.debug(
          `Auto-issued S2S token for authenticated service-only endpoint: ${request.url}`,
        );
      } else {
        // Failed to get S2S token, but continue with original JWT
        this.logger.warn(
          `Could not issue S2S token for ${request.url}, continuing with user JWT token`,
        );
      }
    } catch (error: any) {
      // Handle circuit breaker or other errors gracefully
      if (error?.status === 503 || error?.message?.includes('circuit breaker')) {
        this.logger.warn(
          `Auth service circuit breaker is open. Continuing with user JWT token for ${request.url}`,
        );
      } else {
        this.logger.error(
          `Failed to issue S2S token: ${error.message}`,
          error.stack,
        );
      }
      // Continue with original JWT token - let the guard handle it
      // Don't throw error - allow request to proceed with user JWT
    }

    return next.handle();
  }

  /**
   * Basic JWT token validation (checks format and expiration)
   * Full validation will be done by JwtAuthGuard
   */
  private isValidJwtToken(token: string): boolean {
    try {
      // Basic format check: JWT has 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Try to decode payload to check expiration
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );

      // Check if token is expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached token or issue new one
   */
  private async getOrIssueToken(): Promise<string | null> {
    const cacheKey = `${this.serviceName}:${this.defaultScopes.join(',')}`;
    const cached = this.tokenCache.get(cacheKey);

    // Check if cached token is still valid (with 30s buffer)
    if (cached && cached.expiresAt > Date.now() + 30000) {
      this.logger.debug('Using cached S2S token');
      return cached.token;
    }

    // Issue new token
    try {
      const token = await this.issueToken();
      if (token) {
        // Cache the token
        const expiresAt = Date.now() + this.defaultTtl * 1000;
        this.tokenCache.set(cacheKey, { token, expiresAt });
        this.logger.log(
          `Issued and cached new S2S token (expires in ${this.defaultTtl}s)`,
        );
        return token;
      }
    } catch (error) {
      this.logger.error(`Failed to issue S2S token: ${error.message}`);
      throw error;
    }

    return null;
  }

  /**
   * Issue S2S token from auth service
   * Uses fetch with timeout and graceful error handling
   */
  private async issueToken(): Promise<string | null> {
    if (!this.serviceToken) {
      this.logger.warn(
        'SERVICE_TO_SERVICE_TOKEN not configured, cannot issue S2S token',
      );
      return null;
    }

    const url = `${this.authServiceUrl}/api/v1/internal/auth/s2s/issue`;
    const payload = {
      aud: this.serviceName,
      scopes: this.defaultScopes,
      ttl_sec: this.defaultTtl,
    };

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': this.serviceToken,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        this.logger.warn(
          `Auth service returned ${response.status}: ${errorText}`,
        );
        return null; // Return null instead of throwing
      }

      const data = await response.json();
      return data.token || null;
    } catch (error: any) {
      // Handle timeout, network errors, circuit breaker errors gracefully
      if (error.name === 'AbortError') {
        this.logger.warn(
          `Auth service request timed out after ${this.timeoutMs}ms`,
        );
      } else if (error.message?.includes('circuit breaker')) {
        this.logger.warn('Auth service circuit breaker is open');
      } else {
        this.logger.warn(
          `Failed to call auth service for S2S token: ${error.message}`,
        );
      }
      // Return null instead of throwing - let request continue with original JWT
      return null;
    }
  }

  /**
   * Clear token cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.tokenCache.clear();
    this.logger.debug('S2S token cache cleared');
  }
}

