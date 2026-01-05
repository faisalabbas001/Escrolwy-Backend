import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for starting KYC process
 */
export class StartKycDto {
    @ApiPropertyOptional({
        description: 'Optional reference ID for tracking',
        example: 'ref-12345',
    })
    @IsOptional()
    @IsString()
    referenceId?: string;

    @ApiPropertyOptional({
        description: 'Redirect URL after Persona verification',
        example: 'https://app.escrowly.com/kyc/complete',
    })
    @IsOptional()
    @IsString()
    redirectUri?: string;
}
