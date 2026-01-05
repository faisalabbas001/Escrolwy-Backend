import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

// ====================================
// Enums
// ====================================

export enum AlertSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
    ACTIVE = 'ACTIVE',
    ACKNOWLEDGED = 'ACKNOWLEDGED',
    RESOLVED = 'RESOLVED',
}

export enum AlertType {
    LISTENER_LAG = 'LISTENER_LAG',
    ESCROW_STUCK = 'ESCROW_STUCK',
    LEDGER_MISMATCH = 'LEDGER_MISMATCH',
    FAILED_WITHDRAWALS = 'FAILED_WITHDRAWALS',
    LOW_HOT_WALLET_BALANCE = 'LOW_HOT_WALLET_BALANCE',
}

// ====================================
// Query DTOs
// ====================================

export class AlertQueryDto {
    @ApiPropertyOptional({ enum: AlertStatus, description: 'Filter by status' })
    @IsOptional()
    @IsEnum(AlertStatus)
    status?: AlertStatus;

    @ApiPropertyOptional({ enum: AlertSeverity, description: 'Filter by severity' })
    @IsOptional()
    @IsEnum(AlertSeverity)
    severity?: AlertSeverity;

    @ApiPropertyOptional({ enum: AlertType, description: 'Filter by alert type' })
    @IsOptional()
    @IsEnum(AlertType)
    alertType?: AlertType;

    @ApiPropertyOptional({ description: 'Limit results', default: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number;
}

// ====================================
// Request DTOs
// ====================================

export class AcknowledgeAlertDto {
    @ApiPropertyOptional({ description: 'Optional note for acknowledgement' })
    @IsOptional()
    @IsString()
    note?: string;
}

export class UpdateAlertRuleDto {
    @ApiPropertyOptional({ description: 'Condition expression', example: 'block_lag > 100' })
    @IsOptional()
    @IsString()
    conditionExpression?: string;

    @ApiPropertyOptional({ description: 'Threshold value' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    threshold?: number;

    @ApiPropertyOptional({ enum: AlertSeverity })
    @IsOptional()
    @IsEnum(AlertSeverity)
    severity?: AlertSeverity;

    @ApiPropertyOptional({ description: 'Action (slack, email, sms)', example: 'slack,email' })
    @IsOptional()
    @IsString()
    action?: string;

    @ApiPropertyOptional({ description: 'Is rule active' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// ====================================
// Response DTOs
// ====================================

export class AlertDto {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ enum: AlertType, example: 'LISTENER_LAG' })
    alertType: string;

    @ApiProperty({ example: 'wallet-listener-eth' })
    source: string;

    @ApiProperty({ enum: AlertSeverity, example: 'HIGH' })
    severity: string;

    @ApiProperty({ example: 'Block lag exceeded threshold: 150 blocks behind' })
    description: string;

    @ApiProperty({ enum: AlertStatus, example: 'ACTIVE' })
    status: string;

    @ApiProperty({ example: {} })
    metadata: any;

    @ApiProperty({ example: '2025-01-15T12:00:00Z' })
    createdAt: string;

    @ApiPropertyOptional({ example: '2025-01-15T14:00:00Z' })
    resolvedAt?: string;
}

export class AlertRuleDto {
    @ApiProperty({ example: 'uuid-here' })
    id: string;

    @ApiProperty({ enum: AlertType, example: 'LISTENER_LAG' })
    ruleType: string;

    @ApiProperty({ example: 'block_lag > 100' })
    conditionExpression: string;

    @ApiProperty({ example: 100 })
    threshold: number;

    @ApiProperty({ enum: AlertSeverity, example: 'HIGH' })
    severity: string;

    @ApiProperty({ example: 'slack,email' })
    action: string;

    @ApiProperty({ example: true })
    isActive: boolean;

    @ApiProperty({ example: '2025-01-15T12:00:00Z' })
    updatedAt: string;
}

export class AlertAcknowledgeResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Alert acknowledged successfully' })
    message: string;

    @ApiProperty({ example: 'uuid-here' })
    alertId: string;

    @ApiProperty({ example: 'ACKNOWLEDGED' })
    newStatus: string;
}

export * from './create-alert-rule.dto';
