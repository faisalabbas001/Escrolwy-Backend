import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

// ====================================
// Query DTOs
// ====================================

export class ExportQueryDto {
    @ApiPropertyOptional({ description: 'Export date (ISO 8601)', example: '2025-01-15' })
    @IsOptional()
    @IsDateString()
    date?: string;
}

// ====================================
// Response DTOs
// ====================================

export class DailyExportDto {
    @ApiProperty({ example: '2025-01-15' })
    date: string;

    @ApiProperty({ example: '50000.00' })
    totalDeposits: string;

    @ApiProperty({ example: '30000.00' })
    totalWithdrawals: string;

    @ApiProperty({ example: '20000.00' })
    totalInternalTransfers: string;

    @ApiProperty({ example: 150 })
    escrowCreated: number;

    @ApiProperty({ example: 120 })
    escrowCompleted: number;

    @ApiProperty({ example: 10 })
    escrowDisputed: number;

    @ApiProperty({ example: 5 })
    escrowRefunded: number;

    @ApiProperty({ example: '2500.00' })
    feesCollected: string;

    @ApiProperty({ example: {} })
    volumeByCurrency: any;

    @ApiProperty({ example: '2025-01-15T23:59:59Z' })
    exportedAt: string;
}

export class ManualExportDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Export triggered successfully' })
    message: string;

    @ApiProperty({ example: 's3://exports/2025-01-15/manual-export.json' })
    exportUrl?: string;

    @ApiProperty({ example: '2025-01-15T12:00:00Z' })
    timestamp: string;
}
