import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Get Users Query DTO
 */
export class GetUsersQueryDto {
  @ApiPropertyOptional({ description: 'Search query (email, name)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by role',
    enum: ['user', 'super-admin', 'staff-website'],
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['ACTIVE', 'LOCKED', 'DISABLED'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by KYC state',
    enum: ['not_started', 'pending', 'approved', 'rejected'],
  })
  @IsOptional()
  @IsString()
  kyc_state?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 50;
}

/**
 * Update User Status DTO
 */
export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: ['ACTIVE', 'LOCKED', 'DISABLED'],
  })
  @IsString()
  @IsIn(['ACTIVE', 'LOCKED', 'DISABLED'])
  status: string;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Update User Role DTO
 */
export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role',
    enum: ['user', 'super-admin', 'staff-website'],
  })
  @IsString()
  @IsIn(['user', 'super-admin', 'staff-website'])
  role: string;
}

/**
 * User List Response DTO
 */
export class UserListResponseDto {
  @ApiProperty()
  items: any[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  page_size: number;

  @ApiProperty()
  total: number;
}

/**
 * Update Status Response DTO
 */
export class UpdateStatusResponseDto {
  @ApiProperty()
  status: string;
}

/**
 * Update Role Response DTO
 */
export class UpdateRoleResponseDto {
  @ApiProperty()
  role: string;
}

/**
 * Impersonation Response DTO
 */
export class ImpersonationResponseDto {
  @ApiProperty()
  impersonation_token: string;

  @ApiProperty()
  expires_in: number;
}

/**
 * Revoke Sessions Response DTO
 */
export class RevokeSessionsResponseDto {
  @ApiProperty()
  revoked: boolean;
}
