import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { AlertSeverity } from './index';

export class CreateAlertRuleDto {
    @ApiProperty({ description: 'Type of rule', example: 'LISTENER_LAG' })
    @IsString()
    ruleType: string;

    @ApiProperty({ description: 'Condition expression', example: 'block_lag > 100' })
    @IsString()
    conditionExpression: string;

    @ApiProperty({ description: 'Threshold value', example: 100 })
    @IsNumber()
    threshold: number;

    @ApiProperty({ enum: AlertSeverity, description: 'Severity level' })
    @IsEnum(AlertSeverity)
    severity: AlertSeverity;

    @ApiProperty({ description: 'Action (slack, email, sms)', example: 'slack,email' })
    @IsString()
    action: string;

    @ApiProperty({ description: 'Is rule active', default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
