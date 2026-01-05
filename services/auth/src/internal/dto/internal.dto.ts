import {
  IsString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Issue Service Token DTO
 */
export class IssueServiceTokenDto {
  @ApiProperty({ description: 'Audience (service name)', example: 'ledger' })
  @IsString()
  aud: string;

  @ApiProperty({
    description: 'Scopes/permissions',
    example: ['read:users', 'write:ledger'],
  })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @ApiPropertyOptional({ description: 'TTL in seconds', default: 600 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  ttl_sec?: number;
}

/**
 * Validate Token Response DTO
 */
export class ValidateTokenResponseDto {
  @ApiProperty()
  valid: boolean;

  @ApiProperty()
  sub?: string;

  @ApiProperty()
  role?: string;

  @ApiProperty()
  scopes?: string[];

  @ApiProperty()
  exp?: number;
}

/**
 * Issue Service Token Response DTO
 */
export class IssueServiceTokenResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  expires_in: number;
}

/**
 * Get Emails By User IDs Request DTO
 */
export class GetEmailsByIdsDto {
  @ApiProperty({
    description: 'Array of user IDs',
    example: ['550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  user_ids: string[];
}

/**
 * Get Emails By User IDs Response DTO
 */
export class GetEmailsByIdsResponseDto {
  @ApiProperty({
    description: 'Mapping of user IDs to emails',
    example: {
      '550e8400-e29b-41d4-a716-446655440000': 'user1@example.com',
      '660e8400-e29b-41d4-a716-446655440001': 'user2@example.com',
    },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  emails: Record<string, string>;
}
