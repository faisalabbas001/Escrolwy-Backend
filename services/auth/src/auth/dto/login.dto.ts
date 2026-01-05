import { IsEmail, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Device information for login tracking
 */
export class DeviceInfoDto {
  @ApiPropertyOptional({
    description: 'Device name',
    example: 'Chrome on Windows',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Client IP address',
    example: '192.168.1.1',
  })
  @IsOptional()
  @IsString()
  ip?: string;
}

/**
 * Login Request DTO
 *
 * Authenticates user with email and password
 */
export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!',
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: 'MFA code (if 2FA is enabled)',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  mfaCode?: string;

  @ApiPropertyOptional({
    description: 'Device information for session tracking',
    type: DeviceInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;
}
