import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, IsString } from 'class-validator';

/**
 * DTO for adjusting user limits
 */
export class AdjustLimitsDto {
    @ApiPropertyOptional({
        description: 'New escrow limit',
        example: 50000,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    escrowLimit?: number;

    @ApiPropertyOptional({
        description: 'New ledger limit',
        example: 100000,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    ledgerLimit?: number;
}

/**
 * DTO for approving/rejecting KYC
 */
export class KycDecisionDto {
    @ApiPropertyOptional({
        description: 'Reason for the decision',
        example: 'Manual review completed',
    })
    @IsOptional()
    @IsString()
    reason?: string;
}

/**
 * DTO for resetting KYC
 */
export class ResetKycDto {
    @ApiProperty({
        description: 'Reason for resetting KYC',
        example: 'User requested document re-verification',
    })
    @IsString()
    reason: string;
}
