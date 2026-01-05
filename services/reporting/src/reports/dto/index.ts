import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

// ====================================
// Query DTOs
// ====================================

export class DateRangeQueryDto {
    @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2025-01-01' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2025-12-31' })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class CurrencyQueryDto extends DateRangeQueryDto {
    @ApiPropertyOptional({ description: 'Filter by currency', example: 'ETH' })
    @IsOptional()
    @IsString()
    currency?: string;
}

// ====================================
// Response DTOs
// ====================================

export class EscrowSummaryDto {
    @ApiProperty({ example: 150 })
    totalCreated: number;

    @ApiProperty({ example: 120 })
    totalCompleted: number;

    @ApiProperty({ example: 10 })
    totalDisputed: number;

    @ApiProperty({ example: 5 })
    totalRefunded: number;

    @ApiProperty({ example: 15 })
    totalActive: number;

    @ApiProperty({ example: '125000.00' })
    totalVolume: string;

    @ApiProperty({ example: '2500.00' })
    totalFees: string;
}

export class EscrowTrendDto {
    @ApiProperty({ example: '2025-01-15' })
    date: string;

    @ApiProperty({ example: 10 })
    created: number;

    @ApiProperty({ example: 8 })
    completed: number;

    @ApiProperty({ example: 1 })
    disputed: number;

    @ApiProperty({ example: '15000.00' })
    volume: string;
}

export class TransactionVolumeDto {
    @ApiProperty({ example: '2025-01-15' })
    date: string;

    @ApiProperty({ example: '50000.00' })
    deposits: string;

    @ApiProperty({ example: '30000.00' })
    withdrawals: string;

    @ApiProperty({ example: '20000.00' })
    internalTransfers: string;

    @ApiProperty({ example: '100000.00' })
    totalVolume: string;
}

export class FeesReportDto {
    @ApiProperty({ example: '2025-01-15' })
    date: string;

    @ApiProperty({ example: '500.00' })
    escrowFees: string;

    @ApiProperty({ example: '100.00' })
    withdrawalFees: string;

    @ApiProperty({ example: '600.00' })
    totalFees: string;
}

export class CurrencyBreakdownDto {
    @ApiProperty({ example: 'ETH' })
    currency: string;

    @ApiProperty({ example: '75000.00' })
    totalVolume: string;

    @ApiProperty({ example: 45.5 })
    percentage: number;

    @ApiProperty({ example: 1250 })
    transactionCount: number;
}

export class KycDistributionDto {
    @ApiProperty({ example: 'approved' })
    status: string;

    @ApiProperty({ example: 8500 })
    count: number;

    @ApiProperty({ example: 85.0 })
    percentage: number;
}

export class ActiveUsersDto {
    @ApiProperty({ example: '2025-01-15' })
    date: string;

    @ApiProperty({ example: 1200 })
    dailyActiveUsers: number;

    @ApiProperty({ example: 5500 })
    weeklyActiveUsers: number;

    @ApiProperty({ example: 12000 })
    monthlyActiveUsers: number;

    @ApiProperty({ example: 150 })
    newRegistrations: number;
}

export class WalletDepositsDto {
    @ApiProperty({ example: '2025-01-15' })
    date: string;

    @ApiProperty({ example: 250 })
    count: number;

    @ApiProperty({ example: '125000.00' })
    totalAmount: string;

    @ApiProperty({ example: '500.00' })
    averageAmount: string;

    @ApiProperty({ type: [CurrencyBreakdownDto] })
    byCurrency: CurrencyBreakdownDto[];
}

export class WalletWithdrawalsDto {
    @ApiProperty({ example: '2025-01-15' })
    date: string;

    @ApiProperty({ example: 180 })
    count: number;

    @ApiProperty({ example: '90000.00' })
    totalAmount: string;

    @ApiProperty({ example: '500.00' })
    averageAmount: string;

    @ApiProperty({ example: 5 })
    failedCount: number;

    @ApiProperty({ example: 2.7 })
    failureRate: number;

    @ApiProperty({ type: [CurrencyBreakdownDto] })
    byCurrency: CurrencyBreakdownDto[];
}
