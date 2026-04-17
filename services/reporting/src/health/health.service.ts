import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * Health Service
 *
 * Implements health check logic including database connectivity checks.
 */
@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Basic health check
     */
    check() {
        return {
            status: 'ok',
            service: 'reporting-service',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Readiness check - verifies database connectivity
     */
    async ready() {
        try {
            // Check database connection
            await this.prisma.$queryRaw`SELECT 1`;

            return {
                status: 'ready',
                database: 'connected',
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Readiness check failed', error);
            throw new Error('Service not ready');
        }
    }

    /**
     * Liveness check - always returns success if service is running
     */
    live() {
        return {
            status: 'alive',
            timestamp: new Date().toISOString(),
        };
    }
}
