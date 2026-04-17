import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * KYC Status enum
 */
export enum KycStatus {
    NOT_STARTED = 'NOT_STARTED',
    STARTED = 'STARTED',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    REVIEW_REQUIRED = 'REVIEW_REQUIRED',
}

/**
 * KYC Status Response DTO
 * Used for GET /kyc/status endpoint
 */
export class KycStatusResponseDto {
    @ApiProperty({ example: 'STARTED' })
    status: KycStatus;

    @ApiPropertyOptional({ example: 'inq_abc123' })
    personaInquiryId?: string;

    @ApiProperty({ example: '2025-12-23T12:00:00.000Z' })
    createdAt: string;

    @ApiPropertyOptional({ example: '2025-12-23T12:30:00.000Z' })
    updatedAt?: string;
}

/**
 * Start KYC Response DTO
 * Used for POST /kyc/start endpoint
 * Note: Field renamed from inquiryId to personaInquiryId
 */
export class StartKycResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'STARTED' })
    status: KycStatus;

    @ApiProperty({ example: 'inq_abc123' })
    personaInquiryId: string;

    @ApiProperty({
        example: 'https://withpersona.com/verify?inquiry-id=inq_abc123',
        description: 'URL to redirect user for Persona verification',
    })
    verificationUrl: string;
}

/**
 * Generic KYC Success Response DTO
 */
export class KycSuccessResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'KYC process started' })
    message: string;
}
