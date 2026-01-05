import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Request password reset DTO
 */
export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

/**
 * Response for forgot password request
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'If the email exists, a password reset link has been sent',
  })
  message: string;
}

/**
 * Reset password with token DTO
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token from email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @ApiProperty({
    description:
      'New password (min 8 chars, must contain uppercase, lowercase, number, and special character)',
    example: 'NewSecurePass123!',
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}

/**
 * Response for reset password
 */
export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password has been reset successfully',
  })
  message: string;
}

/**
 * Change password DTO (for authenticated users)
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
  })
  @IsString({ message: 'Current password must be a string' })
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    description:
      'New password (min 8 chars, must contain uppercase, lowercase, number, and special character)',
    example: 'NewSecurePass123!',
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}

/**
 * Response for change password
 */
export class ChangePasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password changed successfully',
  })
  message: string;
}
