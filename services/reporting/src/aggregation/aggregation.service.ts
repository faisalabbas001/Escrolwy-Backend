import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * Aggregation Service
 *
 * Handles aggregation of incoming events into daily_metrics and audit_snapshots.
 * Called by Kafka event handlers.
 */
@Injectable()
export class AggregationService {
    private readonly logger = new Logger(AggregationService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get or create daily metrics record for a date
     */
    async getOrCreateDailyMetrics(date: Date) {
        const dateOnly = new Date(date.toISOString().split('T')[0]);

        let metrics = await this.prisma.dailyMetrics.findUnique({
            where: { date: dateOnly },
        });

        if (!metrics) {
            metrics = await this.prisma.dailyMetrics.create({
                data: {
                    date: dateOnly,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    totalInternalTransfers: 0,
                    escrowCreated: 0,
                    escrowCompleted: 0,
                    escrowDisputed: 0,
                    escrowRefunded: 0,
                    feesCollected: 0,
                    volumeByCurrency: {},
                },
            });
        }

        return metrics;
    }

    /**
     * Increment deposit amount
     */
    async recordDeposit(amount: number, currency: string) {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        const volumeByCurrency = (metrics.volumeByCurrency as any) || {};
        if (!volumeByCurrency[currency]) {
            volumeByCurrency[currency] = { volume: 0, count: 0 };
        }
        volumeByCurrency[currency].volume += amount;
        volumeByCurrency[currency].count += 1;

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: {
                totalDeposits: { increment: amount },
                volumeByCurrency,
            },
        });

        this.logger.debug(`Recorded deposit: ${amount} ${currency}`);
    }

    /**
     * Increment withdrawal amount
     */
    async recordWithdrawal(amount: number, currency: string) {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        const volumeByCurrency = (metrics.volumeByCurrency as any) || {};
        if (!volumeByCurrency[currency]) {
            volumeByCurrency[currency] = { volume: 0, count: 0 };
        }
        volumeByCurrency[currency].volume += amount;
        volumeByCurrency[currency].count += 1;

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: {
                totalWithdrawals: { increment: amount },
                volumeByCurrency,
            },
        });

        this.logger.debug(`Recorded withdrawal: ${amount} ${currency}`);
    }

    /**
     * Record internal transfer
     */
    async recordInternalTransfer(amount: number, currency: string) {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: {
                totalInternalTransfers: { increment: amount },
            },
        });

        this.logger.debug(`Recorded internal transfer: ${amount} ${currency}`);
    }

    /**
     * Increment escrow created count
     */
    async recordEscrowCreated() {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: { escrowCreated: { increment: 1 } },
        });

        this.logger.debug('Recorded escrow created');
    }

    /**
     * Increment escrow completed count
     */
    async recordEscrowCompleted() {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: { escrowCompleted: { increment: 1 } },
        });

        this.logger.debug('Recorded escrow completed');
    }

    /**
     * Increment escrow disputed count
     */
    async recordEscrowDisputed() {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: { escrowDisputed: { increment: 1 } },
        });

        this.logger.debug('Recorded escrow disputed');
    }

    /**
     * Increment escrow refunded count
     */
    async recordEscrowRefunded() {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: { escrowRefunded: { increment: 1 } },
        });

        this.logger.debug('Recorded escrow refunded');
    }

    /**
     * Record fees collected
     */
    async recordFees(amount: number) {
        const today = new Date();
        const metrics = await this.getOrCreateDailyMetrics(today);

        await this.prisma.dailyMetrics.update({
            where: { id: metrics.id },
            data: { feesCollected: { increment: amount } },
        });

        this.logger.debug(`Recorded fees: ${amount}`);
    }

    /**
     * Create audit snapshot
     */
    async createAuditSnapshot(data: {
        eventType: string;
        referenceId: string;
        userId?: string;
        amount?: number;
        metadata?: any;
    }) {
        await this.prisma.auditSnapshot.create({
            data: {
                eventType: data.eventType,
                referenceId: data.referenceId,
                userId: data.userId,
                amount: data.amount,
                metadata: data.metadata || {},
            },
        });

        this.logger.debug(`Created audit snapshot: ${data.eventType} - ${data.referenceId}`);
    }

    /**
     * Update system metric
     */
    async updateSystemMetric(data: {
        serviceName: string;
        metricType: string;
        metricValue: number;
        chain?: string;
    }) {
        await this.prisma.systemMetrics.upsert({
            where: {
                serviceName_metricType_chain: {
                    serviceName: data.serviceName,
                    metricType: data.metricType,
                    chain: data.chain || '',
                },
            },
            create: {
                serviceName: data.serviceName,
                metricType: data.metricType,
                metricValue: data.metricValue,
                chain: data.chain,
            },
            update: {
                metricValue: data.metricValue,
            },
        });

        this.logger.debug(`Updated system metric: ${data.serviceName} - ${data.metricType} = ${data.metricValue}`);
    }
}
