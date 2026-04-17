import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 2FA Setup Response DTO
 *
 * Returns only the QR code for setting up 2FA
 * The secret and otpauthUrl are kept server-side for security
 */
export class TwoFactorSetupResponseDto {
  @ApiProperty({
    description: 'QR code as base64 data URL for scanning with authenticator app',
    example: 'data:image/png;base64,iVBORw0KGgo...',
  })
  qrCodeDataUrl: string;
}

/**
 * 2FA Verify Request DTO
 *
 * Used to verify a TOTP code
 */
export class TwoFactorVerifyDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;
}

/**
 * 2FA Verify Response DTO
 */
export class TwoFactorVerifyResponseDto {
  @ApiProperty({
    description: 'Whether 2FA is now enabled',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Two-factor authentication enabled successfully',
  })
  message: string;
}

/**
 * 2FA Disable Request DTO
 */
export class TwoFactorDisableDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app to confirm disable',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;
}

/**
 * 2FA Disable Response DTO
 */
export class TwoFactorDisableResponseDto {
  @ApiProperty({
    description: 'Whether 2FA is now disabled',
    example: false,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Two-factor authentication disabled successfully',
  })
  message: string;
}

/**
 * 2FA Status Response DTO
 */
export class TwoFactorStatusResponseDto {
  @ApiProperty({
    description: 'Whether 2FA is enabled for the user',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: '2FA type (totp)',
    example: 'totp',
    required: false,
  })
  type?: string;
}

/**
 * 2FA Backup Code Consume Request DTO
 */
export class TwoFactorBackupCodeConsumeDto {
  @ApiProperty({
    description: '8-character backup code',
    example: 'A1B2C3D4',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 8, { message: 'Backup code must be exactly 8 characters' })
  code: string;
}

/**
 * 2FA Backup Code Consume Response DTO
 */
export class TwoFactorBackupCodeConsumeResponseDto {
  @ApiProperty({
    description: 'Success indicator',
    example: true,
  })
  ok: boolean;
}
