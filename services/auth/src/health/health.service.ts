import {
  Injectable,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';

/**
 * Health Service
 *
 * Implements health check logic for the Auth Service.
 * Verifies database connectivity and service readiness.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Basic health check
   */
  check() {
    return {
      status: 'ok',
      service: this.config.get('SERVICE_NAME', 'auth-service'),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check - verifies database connectivity
   */
  async ready() {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ready',
        service: this.config.get('SERVICE_NAME', 'auth-service'),
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: this.config.get('SERVICE_NAME', 'auth-service'),
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Liveness check
   */
  live() {
    return {
      status: 'alive',
      service: this.config.get('SERVICE_NAME', 'auth-service'),
      timestamp: new Date().toISOString(),
    };
  }
}
