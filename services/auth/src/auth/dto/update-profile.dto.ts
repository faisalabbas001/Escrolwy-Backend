import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Update Profile DTO
 *
 * Allows users to update their profile information
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Display name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Primary phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryPhone?: string;

  @ApiPropertyOptional({
    description: 'Company name',
    example: 'Acme Inc',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Company representative name',
    example: 'Jane Smith',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyRepresentativeName?: string;

  @ApiPropertyOptional({
    description: 'Company billing address',
    example: '123 Business St, City, Country',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyBillingAddress?: string;

  @ApiPropertyOptional({
    description: 'Preferred language (ISO code)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  preferredLanguage?: string;
}

/**
 * Update Profile Response DTO
 */
export class UpdateProfileResponseDto {
  @ApiPropertyOptional({ example: 'Profile updated successfully' })
  message: string;

  @ApiPropertyOptional()
  profile: {
    displayName?: string;
    primaryPhone?: string;
    companyName?: string;
    companyRepresentativeName?: string;
    companyBillingAddress?: string;
    preferredLanguage?: string;
  };
}
