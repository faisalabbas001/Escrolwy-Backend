import { IsString, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceInfoDto } from './login.dto';

/**
 * Token Refresh Request DTO
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  refreshToken: string;

  @ApiPropertyOptional({
    description: 'Device information',
    type: DeviceInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;
}

/**
 * Session/Token Response DTO
 */
export class SessionResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Access token expiry in seconds',
    example: 900,
  })
  accessExpiresIn: number;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Refresh token expiry in seconds',
    example: 2592000,
  })
  refreshExpiresIn: number;
}

/**
 * KYC Status Response DTO
 */
export class KycResponseDto {
  @ApiProperty({
    description: 'KYC state',
    enum: ['not_started', 'pending', 'approved', 'rejected'],
    example: 'not_started',
  })
  state: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: string;
}

/**
 * Signup Response DTO
 */
export class SignupResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User role',
    example: 'user',
  })
  role: string;

  @ApiProperty({
    description: 'KYC status',
    type: KycResponseDto,
  })
  kyc: KycResponseDto;

  @ApiProperty({
    description: 'Session tokens',
    type: SessionResponseDto,
  })
  session: SessionResponseDto;
}

/**
 * Login Response DTO
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'User role',
    example: 'user',
  })
  role: string;

  @ApiProperty({
    description:
      'Whether MFA code is still required (true = waiting for MFA, false = authenticated)',
    example: false,
  })
  requiresMfa: boolean;

  @ApiPropertyOptional({
    description: 'Whether MFA was enabled and verified for this login',
    example: false,
  })
  mfaEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Session tokens (only provided when authentication is complete)',
    type: SessionResponseDto,
  })
  session?: SessionResponseDto;
}

/**
 * Token Refresh Response DTO
 */
export class RefreshResponseDto extends SessionResponseDto {}

// Stub DTOs for removed functionality (methods still exist but services removed)
export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsString()
  email: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  newPassword: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  newPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateProfileResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Updated display name' })
  displayName?: string;
}

