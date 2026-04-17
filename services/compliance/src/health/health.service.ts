import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * Health Service
 *
 * Provides health check methods for the Compliance Service.
 */
@Injectable()
export class HealthService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Basic health check - returns service status
     */
    check() {
        return {
            status: 'ok',
            service: 'compliance-service',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Readiness check - verifies database connectivity
     */
    async ready() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return {
                status: 'ready',
                service: 'compliance-service',
                database: 'connected',
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                status: 'not_ready',
                service: 'compliance-service',
                database: 'disconnected',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Liveness check - confirms service is alive
     */
    live() {
        return {
            status: 'alive',
            service: 'compliance-service',
            timestamp: new Date().toISOString(),
        };
    }
}
