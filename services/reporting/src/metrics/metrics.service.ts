import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import {
    MetricsQueryDto,
    ListenerMetricsDto,
    EventMetricsDto,
    ErrorMetricsDto,
    HotWalletMetricsDto,
    AuditMetricsDto,
} from './dto';

/**
 * Metrics Service
 *
 * READ-ONLY service for system and infrastructure health metrics.
 */
@Injectable()
export class MetricsService {
    private readonly logger = new Logger(MetricsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getListenerMetrics(query: MetricsQueryDto): Promise<ListenerMetricsDto[]> {
        try {
            const where: any = { metricType: 'listener_lag' };
            if (query.serviceName) where.serviceName = query.serviceName;
            if (query.chain) where.chain = query.chain;

            const metrics = await this.prisma.systemMetrics.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
            });

            return metrics.map((m) => ({
                serviceName: m.serviceName,
                chain: m.chain || 'UNKNOWN',
                lastProcessedBlock: 0, // Would come from metadata
                latestChainBlock: 0,
                blockLag: Number(m.metricValue),
                status: Number(m.metricValue) < 100 ? 'healthy' : 'lagging',
                lastUpdated: m.updatedAt.toISOString(),
            }));
        } catch (error) {
            this.logger.error('Error fetching listener metrics', error);
            return [];
        }
    }

    async getEventMetrics(): Promise<EventMetricsDto[]> {
        try {
            const metrics = await this.prisma.systemMetrics.findMany({
                where: { metricType: 'kafka_events' },
                orderBy: { serviceName: 'asc' },
            });

            return metrics.map((m) => ({
                topic: m.serviceName,
                totalProcessed: Number(m.metricValue),
                processedLast24h: 0, // Would need time-based aggregation
                processedLastHour: 0,
                failedCount: 0,
                failureRate: 0,
                avgProcessingTimeMs: 0,
            }));
        } catch (error) {
            this.logger.error('Error fetching event metrics', error);
            return [];
        }
    }

    async getErrorMetrics(query: MetricsQueryDto): Promise<ErrorMetricsDto[]> {
        try {
            const where: any = { metricType: { startsWith: 'error_' } };
            if (query.serviceName) where.serviceName = query.serviceName;

            const metrics = await this.prisma.systemMetrics.findMany({
                where,
                orderBy: { metricValue: 'desc' },
                take: 20,
            });

            const totalErrors = metrics.reduce((sum, m) => sum + Number(m.metricValue), 0);

            return metrics.map((m) => ({
                serviceName: m.serviceName,
                errorType: m.metricType.replace('error_', ''),
                count: Number(m.metricValue),
                percentageOfTotal: totalErrors > 0 ? Number(((Number(m.metricValue) / totalErrors) * 100).toFixed(2)) : 0,
                lastOccurrence: m.updatedAt.toISOString(),
            }));
        } catch (error) {
            this.logger.error('Error fetching error metrics', error);
            return [];
        }
    }

    async getHotWalletMetrics(query: MetricsQueryDto): Promise<HotWalletMetricsDto[]> {
        try {
            const where: any = { metricType: 'wallet_balance' };
            if (query.chain) where.chain = query.chain;

            const metrics = await this.prisma.systemMetrics.findMany({
                where,
                orderBy: { chain: 'asc' },
            });

            return metrics.map((m) => ({
                chain: m.chain || 'UNKNOWN',
                address: m.serviceName, // Using serviceName to store address
                balance: m.metricValue.toString(),
                maxCapacity: '1000.00', // Would come from config
                utilizationPercent: Number(m.metricValue) / 10, // Example calculation
                status: Number(m.metricValue) > 100 ? 'healthy' : 'low',
                lastUpdated: m.updatedAt.toISOString(),
            }));
        } catch (error) {
            this.logger.error('Error fetching hot wallet metrics', error);
            return [];
        }
    }

    async getAuditMetrics(): Promise<AuditMetricsDto[]> {
        try {
            const now = new Date();
            const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

            // Group by event type
            const groupedAll = await this.prisma.auditSnapshot.groupBy({
                by: ['eventType'],
                _count: true,
            });

            const results: AuditMetricsDto[] = [];

            for (const group of groupedAll) {
                const last24hCount = await this.prisma.auditSnapshot.count({
                    where: {
                        eventType: group.eventType,
                        createdAt: { gte: last24h },
                    },
                });

                const lastHourCount = await this.prisma.auditSnapshot.count({
                    where: {
                        eventType: group.eventType,
                        createdAt: { gte: lastHour },
                    },
                });

                results.push({
                    eventType: group.eventType,
                    totalCount: group._count,
                    last24hCount,
                    lastHourCount,
                    topActions: [], // Would need more complex aggregation
                });
            }

            return results;
        } catch (error) {
            this.logger.error('Error fetching audit metrics', error);
            return [];
        }
    }
}
