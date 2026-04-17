import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { RedisService } from '../redis';
import { ListenerService } from '../listener';
import { ListenerStatus } from '../listener/interfaces';

/**
 * Health Check Response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  service: string;
  chains: string[];
  uptime: number;
  checks: {
    database: { status: 'ok' | 'error'; latency?: number; error?: string };
    redis: { status: 'ok' | 'error'; latency?: number; error?: string };
    listener: ListenerHealthSummary;
  };
}

type ListenerHealthStatus = 'ok' | 'error' | 'starting';

export interface ListenerHealthSummary {
  status: ListenerHealthStatus;
  aggregateLag?: number;
  chains: Record<
    string,
    | (ListenerStatus & { status: 'ok' })
    | { status: 'error' | 'starting'; error?: string }
  >;
  error?: string;
}

/**
 * Health Service
 *
 * Provides health check functionality for the listener-engine service.
 * Checks database, Redis, and listener status.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly listenerService: ListenerService,
  ) {}

  /**
   * Perform comprehensive health check
   */
  async check(): Promise<HealthCheckResponse> {
    const [dbCheck, redisCheck, listenerCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkListener(),
    ]);

    // Determine overall status
    let status: 'ok' | 'degraded' | 'error' = 'ok';

    if (dbCheck.status === 'error' || redisCheck.status === 'error') {
      status = 'error';
    } else if (listenerCheck.status === 'error') {
      status = 'degraded';
    } else if (listenerCheck.status === 'starting') {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      service: 'listener-engine',
      chains: this.listenerService.getChainIds(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbCheck,
        redis: redisCheck,
        listener: listenerCheck,
      },
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<{
    status: 'ok' | 'error';
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { status: 'ok', latency };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<{
    status: 'ok' | 'error';
    latency?: number;
    error?: string;
  }> {
    try {
      if (!this.redis.isConnected()) {
        return { status: 'error', error: 'Not connected' };
      }

      const start = Date.now();
      await this.redis.getClient().ping();
      const latency = Date.now() - start;
      return { status: 'ok', latency };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Check listener status
   */
  private async checkListener(): Promise<ListenerHealthSummary> {
    try {
      const statuses = await this.listenerService.getStatuses();
      const chains = this.listenerService.getChainIds();

      if (chains.length === 0) {
        return { status: 'starting', chains: {} };
      }

      let overall: ListenerHealthStatus = 'ok';
      let totalLag = 0;
      let lagCount = 0;
      const chainResults: ListenerHealthSummary['chains'] = {};

      for (const chainId of chains) {
        const status = statuses[chainId];

        if (!status) {
          chainResults[chainId] = { status: 'starting' };
          overall = overall === 'error' ? 'error' : 'starting';
          continue;
        }

        if (!status.isRunning) {
          chainResults[chainId] = { status: 'error', error: 'Listener not running' };
          overall = 'error';
          continue;
        }

        chainResults[chainId] = { ...status, status: 'ok' };
        if (typeof status.lag === 'number') {
          totalLag += status.lag;
          lagCount += 1;
        }
      }

      const aggregateLag = lagCount > 0 ? Math.round(totalLag / lagCount) : undefined;

      return {
        status: overall,
        aggregateLag,
        chains: chainResults,
      };
    } catch (error) {
      this.logger.error(`Listener health check failed: ${error.message}`);
      return { status: 'error', chains: {}, error: error.message };
    }
  }

  /**
   * Simple liveness check (is the service running?)
   */
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness check (is the service ready to accept traffic?)
   */
  async readiness(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      // Check database
      await this.prisma.$queryRaw`SELECT 1`;

      // Check Redis
      if (!this.redis.isConnected()) {
        return { status: 'error', message: 'Redis not connected' };
      }

      // Check listener is running
      if (!this.listenerService.isRunning()) {
        return { status: 'error', message: 'Listener not running' };
      }

      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

