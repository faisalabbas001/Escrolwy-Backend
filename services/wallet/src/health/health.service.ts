import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { RedisService } from '../redis';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  checks: {
    database: { status: string; latencyMs?: number };
    redis: { status: string; latencyMs?: number };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthStatus> {
    const checks = await this.performChecks();
    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
    const anyHealthy = Object.values(checks).some((c) => c.status === 'ok');

    return {
      status: allHealthy ? 'ok' : anyHealthy ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: this.configService.get<string>('SERVICE_NAME', 'wallet-service'),
      version: '1.0.0',
      checks,
    };
  }

  async checkReadiness(): Promise<HealthStatus> {
    return this.check();
  }

  private async performChecks(): Promise<HealthStatus['checks']> {
    const [dbCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      database: dbCheck,
      redis: redisCheck,
    };
  }

  private async checkDatabase(): Promise<{ status: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return { status: 'error' };
    }
  }

  private async checkRedis(): Promise<{ status: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      const isConnected = this.redis.isConnected();
      if (!isConnected) {
        return { status: 'error' };
      }
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return { status: 'error' };
    }
  }
}

