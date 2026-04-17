import {
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Signup Request DTO
 *
 * Creates a new user account with profile information
 */
export class SignupDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Password (min 8 chars, must contain uppercase, lowercase, number)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

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
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  preferredLanguage?: string;

  @ApiProperty({
    description: 'User accepts terms and conditions',
    example: true,
  })
  @IsBoolean()
  acceptTerms: boolean;
}
