import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// ====================================
// Query DTOs
// ====================================

export class MetricsQueryDto {
    @ApiPropertyOptional({ description: 'Filter by service name', example: 'wallet-listener' })
    @IsOptional()
    @IsString()
    serviceName?: string;

    @ApiPropertyOptional({ description: 'Filter by chain', example: 'ETH' })
    @IsOptional()
    @IsString()
    chain?: string;
}

// ====================================
// Response DTOs
// ====================================

export class ListenerMetricsDto {
    @ApiProperty({ example: 'wallet-listener-eth' })
    serviceName: string;

    @ApiProperty({ example: 'ETH' })
    chain: string;

    @ApiProperty({ example: 12500000 })
    lastProcessedBlock: number;

    @ApiProperty({ example: 12500050 })
    latestChainBlock: number;

    @ApiProperty({ example: 50 })
    blockLag: number;

    @ApiProperty({ example: 'healthy' })
    status: string;

    @ApiProperty({ example: '2025-01-15T12:00:00Z' })
    lastUpdated: string;
}

export class EventMetricsDto {
    @ApiProperty({ example: 'ledger.entry.created' })
    topic: string;

    @ApiProperty({ example: 15000 })
    totalProcessed: number;

    @ApiProperty({ example: 250 })
    processedLast24h: number;

    @ApiProperty({ example: 12 })
    processedLastHour: number;

    @ApiProperty({ example: 5 })
    failedCount: number;

    @ApiProperty({ example: 0.03 })
    failureRate: number;

    @ApiProperty({ example: 150 })
    avgProcessingTimeMs: number;
}

export class ErrorMetricsDto {
    @ApiProperty({ example: 'wallet-service' })
    serviceName: string;

    @ApiProperty({ example: 'WITHDRAWAL_FAILED' })
    errorType: string;

    @ApiProperty({ example: 15 })
    count: number;

    @ApiProperty({ example: 0.5 })
    percentageOfTotal: number;

    @ApiProperty({ example: '2025-01-15T11:45:00Z' })
    lastOccurrence: string;
}

export class HotWalletMetricsDto {
    @ApiProperty({ example: 'ETH' })
    chain: string;

    @ApiProperty({ example: '0x1234...5678' })
    address: string;

    @ApiProperty({ example: '125.50' })
    balance: string;

    @ApiProperty({ example: '1000.00' })
    maxCapacity: string;

    @ApiProperty({ example: 12.55 })
    utilizationPercent: number;

    @ApiProperty({ example: 'healthy' })
    status: string;

    @ApiProperty({ example: '2025-01-15T12:00:00Z' })
    lastUpdated: string;
}

export class AuditMetricsDto {
    @ApiProperty({ example: 'admin_action' })
    eventType: string;

    @ApiProperty({ example: 150 })
    totalCount: number;

    @ApiProperty({ example: 25 })
    last24hCount: number;

    @ApiProperty({ example: 5 })
    lastHourCount: number;

    @ApiProperty({ example: ['user_locked', 'kyc_approved', 'limits_adjusted'] })
    topActions: string[];
}
