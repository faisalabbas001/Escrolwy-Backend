import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ExportQueryDto, DailyExportDto, ManualExportDto } from './dto';

/**
 * Exports Service
 *
 * Service for data exports to S3/Data Lake.
 */
@Injectable()
export class ExportsService {
    private readonly logger = new Logger(ExportsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getDailyExport(query: ExportQueryDto): Promise<DailyExportDto> {
        const date = query.date ? new Date(query.date) : new Date();
        const dateStr = date.toISOString().split('T')[0];

        try {
            const metrics = await this.prisma.dailyMetrics.findUnique({
                where: { date },
            });

            if (!metrics) {
                return {
                    date: dateStr,
                    totalDeposits: '0.00',
                    totalWithdrawals: '0.00',
                    totalInternalTransfers: '0.00',
                    escrowCreated: 0,
                    escrowCompleted: 0,
                    escrowDisputed: 0,
                    escrowRefunded: 0,
                    feesCollected: '0.00',
                    volumeByCurrency: {},
                    exportedAt: new Date().toISOString(),
                };
            }

            return {
                date: dateStr,
                totalDeposits: metrics.totalDeposits.toString(),
                totalWithdrawals: metrics.totalWithdrawals.toString(),
                totalInternalTransfers: metrics.totalInternalTransfers.toString(),
                escrowCreated: metrics.escrowCreated,
                escrowCompleted: metrics.escrowCompleted,
                escrowDisputed: metrics.escrowDisputed,
                escrowRefunded: metrics.escrowRefunded,
                feesCollected: metrics.feesCollected.toString(),
                volumeByCurrency: metrics.volumeByCurrency,
                exportedAt: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Error fetching daily export', error);
            return {
                date: dateStr,
                totalDeposits: '0.00',
                totalWithdrawals: '0.00',
                totalInternalTransfers: '0.00',
                escrowCreated: 0,
                escrowCompleted: 0,
                escrowDisputed: 0,
                escrowRefunded: 0,
                feesCollected: '0.00',
                volumeByCurrency: {},
                exportedAt: new Date().toISOString(),
            };
        }
    }

    async triggerManualExport(query: ExportQueryDto): Promise<ManualExportDto> {
        const date = query.date ? new Date(query.date) : new Date();
        const dateStr = date.toISOString().split('T')[0];

        try {
            // In production, this would trigger an S3 export
            // For now, just return success
            this.logger.log(`Manual export triggered for date: ${dateStr}`);

            return {
                success: true,
                message: 'Export triggered successfully',
                exportUrl: `s3://exports/${dateStr}/manual-export.json`,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Error triggering manual export', error);
            return {
                success: false,
                message: 'Export failed',
                timestamp: new Date().toISOString(),
            };
        }
    }
}
