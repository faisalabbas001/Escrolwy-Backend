import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import {
    DateRangeQueryDto,
    CurrencyQueryDto,
    EscrowSummaryDto,
    EscrowTrendDto,
    TransactionVolumeDto,
    FeesReportDto,
    CurrencyBreakdownDto,
    KycDistributionDto,
    ActiveUsersDto,
    WalletDepositsDto,
    WalletWithdrawalsDto,
} from './dto';

/**
 * Reports Service
 *
 * READ-ONLY service for generating reports from aggregated data.
 * All data comes from the reporting_db populated by Kafka consumers.
 */
@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get date range for queries
     */
    private getDateRange(query: DateRangeQueryDto) {
        const endDate = query.endDate ? new Date(query.endDate) : new Date();
        const startDate = query.startDate
            ? new Date(query.startDate)
            : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
        return { startDate, endDate };
    }

    // ====================================
    // ESCROW & TRANSACTION REPORTS
    // ====================================

    async getEscrowSummary(query: DateRangeQueryDto): Promise<EscrowSummaryDto> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            const metrics = await this.prisma.dailyMetrics.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                },
                _sum: {
                    escrowCreated: true,
                    escrowCompleted: true,
                    escrowDisputed: true,
                    escrowRefunded: true,
                    feesCollected: true,
                },
            });

            const totalCreated = metrics._sum.escrowCreated || 0;
            const totalCompleted = metrics._sum.escrowCompleted || 0;
            const totalDisputed = metrics._sum.escrowDisputed || 0;
            const totalRefunded = metrics._sum.escrowRefunded || 0;

            return {
                totalCreated,
                totalCompleted,
                totalDisputed,
                totalRefunded,
                totalActive: totalCreated - totalCompleted - totalRefunded,
                totalVolume: '0.00', // Will be populated from audit_snapshots
                totalFees: metrics._sum.feesCollected?.toString() || '0.00',
            };
        } catch (error) {
            this.logger.error('Error fetching escrow summary', error);
            return {
                totalCreated: 0,
                totalCompleted: 0,
                totalDisputed: 0,
                totalRefunded: 0,
                totalActive: 0,
                totalVolume: '0.00',
                totalFees: '0.00',
            };
        }
    }

    async getEscrowTrends(query: DateRangeQueryDto): Promise<EscrowTrendDto[]> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            const metrics = await this.prisma.dailyMetrics.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                },
                orderBy: { date: 'asc' },
            });

            return metrics.map((m) => ({
                date: m.date.toISOString().split('T')[0],
                created: m.escrowCreated,
                completed: m.escrowCompleted,
                disputed: m.escrowDisputed,
                volume: '0.00', // Will be populated from volumeByCurrency
            }));
        } catch (error) {
            this.logger.error('Error fetching escrow trends', error);
            return [];
        }
    }

    async getTransactionVolume(query: DateRangeQueryDto): Promise<TransactionVolumeDto[]> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            const metrics = await this.prisma.dailyMetrics.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                },
                orderBy: { date: 'asc' },
            });

            return metrics.map((m) => ({
                date: m.date.toISOString().split('T')[0],
                deposits: m.totalDeposits.toString(),
                withdrawals: m.totalWithdrawals.toString(),
                internalTransfers: m.totalInternalTransfers.toString(),
                totalVolume: (
                    Number(m.totalDeposits) +
                    Number(m.totalWithdrawals) +
                    Number(m.totalInternalTransfers)
                ).toFixed(2),
            }));
        } catch (error) {
            this.logger.error('Error fetching transaction volume', error);
            return [];
        }
    }

    async getFees(query: DateRangeQueryDto): Promise<FeesReportDto[]> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            const metrics = await this.prisma.dailyMetrics.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                },
                orderBy: { date: 'asc' },
            });

            return metrics.map((m) => ({
                date: m.date.toISOString().split('T')[0],
                escrowFees: m.feesCollected.toString(),
                withdrawalFees: '0.00', // Will be populated separately
                totalFees: m.feesCollected.toString(),
            }));
        } catch (error) {
            this.logger.error('Error fetching fees', error);
            return [];
        }
    }

    async getCurrencies(query: DateRangeQueryDto): Promise<CurrencyBreakdownDto[]> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            const metrics = await this.prisma.dailyMetrics.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                },
            });

            // Aggregate currency data from volumeByCurrency JSON field
            const currencyTotals: { [key: string]: { volume: number; count: number } } = {};
            let totalVolume = 0;

            for (const m of metrics) {
                const volumeData = m.volumeByCurrency as { [key: string]: { volume: number; count: number } };
                if (volumeData && typeof volumeData === 'object') {
                    for (const [currency, data] of Object.entries(volumeData)) {
                        if (!currencyTotals[currency]) {
                            currencyTotals[currency] = { volume: 0, count: 0 };
                        }
                        currencyTotals[currency].volume += data.volume || 0;
                        currencyTotals[currency].count += data.count || 0;
                        totalVolume += data.volume || 0;
                    }
                }
            }

            return Object.entries(currencyTotals).map(([currency, data]) => ({
                currency,
                totalVolume: data.volume.toFixed(2),
                percentage: totalVolume > 0 ? Number(((data.volume / totalVolume) * 100).toFixed(1)) : 0,
                transactionCount: data.count,
            }));
        } catch (error) {
            this.logger.error('Error fetching currencies', error);
            return [];
        }
    }

    // ====================================
    // USER & WALLET INSIGHTS
    // ====================================

    async getKycDistribution(): Promise<KycDistributionDto[]> {
        try {
            // Aggregate KYC snapshots by status
            const snapshots = await this.prisma.auditSnapshot.groupBy({
                by: ['eventType'],
                where: {
                    eventType: { startsWith: 'kyc_' },
                },
                _count: true,
            });

            const total = snapshots.reduce((sum, s) => sum + s._count, 0);

            return snapshots.map((s) => ({
                status: s.eventType.replace('kyc_', ''),
                count: s._count,
                percentage: total > 0 ? Number(((s._count / total) * 100).toFixed(1)) : 0,
            }));
        } catch (error) {
            this.logger.error('Error fetching KYC distribution', error);
            // Return default distribution
            return [
                { status: 'not_started', count: 0, percentage: 0 },
                { status: 'pending', count: 0, percentage: 0 },
                { status: 'approved', count: 0, percentage: 0 },
                { status: 'rejected', count: 0, percentage: 0 },
            ];
        }
    }

    async getActiveUsers(query: DateRangeQueryDto): Promise<ActiveUsersDto[]> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            // This would typically come from a separate user activity table
            // For now, we'll return placeholder data
            return [
                {
                    date: endDate.toISOString().split('T')[0],
                    dailyActiveUsers: 0,
                    weeklyActiveUsers: 0,
                    monthlyActiveUsers: 0,
                    newRegistrations: 0,
                },
            ];
        } catch (error) {
            this.logger.error('Error fetching active users', error);
            return [];
        }
    }

    async getWalletDeposits(query: CurrencyQueryDto): Promise<WalletDepositsDto[]> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            const metrics = await this.prisma.dailyMetrics.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                },
                orderBy: { date: 'asc' },
            });

            return metrics.map((m) => ({
                date: m.date.toISOString().split('T')[0],
                count: 0, // Would need separate counter
                totalAmount: m.totalDeposits.toString(),
                averageAmount: '0.00',
                byCurrency: [],
            }));
        } catch (error) {
            this.logger.error('Error fetching wallet deposits', error);
            return [];
        }
    }

    async getWalletWithdrawals(query: CurrencyQueryDto): Promise<WalletWithdrawalsDto[]> {
        const { startDate, endDate } = this.getDateRange(query);

        try {
            const metrics = await this.prisma.dailyMetrics.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                },
                orderBy: { date: 'asc' },
            });

            return metrics.map((m) => ({
                date: m.date.toISOString().split('T')[0],
                count: 0, // Would need separate counter
                totalAmount: m.totalWithdrawals.toString(),
                averageAmount: '0.00',
                failedCount: 0,
                failureRate: 0,
                byCurrency: [],
            }));
        } catch (error) {
            this.logger.error('Error fetching wallet withdrawals', error);
            return [];
        }
    }
}
