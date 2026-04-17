import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionResponseDto } from './token.dto';

/**
 * Supported OAuth Providers
 */
export const OAUTH_PROVIDERS = ['google', 'apple'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * OAuth Start Request DTO
 * POST /auth/oauth/:provider/start
 *
 * Initiates OAuth flow by generating authorization URL
 */
export class OAuthStartDto {
  @ApiProperty({
    description: 'Redirect URI after OAuth completion (must be registered with provider)',
    example: 'https://escrowly.com/auth/callback',
  })
  @IsString()
  redirect_uri: string;

  @ApiProperty({
    description: 'State parameter for CSRF protection (will be validated in callback)',
    example: 'random-state-string-12345',
  })
  @IsString()
  state: string;
}

/**
 * OAuth Start Response DTO
 */
export class OAuthStartResponseDto {
  @ApiProperty({
    description: 'Authorization URL to redirect user to provider login',
    example: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&scope=...&state=...',
  })
  authorization_url: string;
}

/**
 * OAuth Callback Request DTO
 * POST /auth/oauth/:provider/callback
 *
 * Handles OAuth callback after user authorizes
 */
export class OAuthCallbackDto {
  @ApiProperty({
    description: 'Authorization code from OAuth provider',
    example: '4/0AY0e-g7q...',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'State parameter for CSRF validation (must match state from /start)',
    example: 'random-state-string-12345',
  })
  @IsString()
  state: string;

  @ApiProperty({
    description: 'Redirect URI (must match the one used in /start)',
    example: 'https://escrowly.com/auth/callback',
  })
  @IsString()
  redirect_uri: string;
}

/**
 * OAuth Callback Response DTO
 * Same shape as /auth/login response
 */
export class OAuthCallbackResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  user_id: string;

  @ApiProperty({
    description: 'User role',
    enum: ['BUYER', 'SELLER', 'BROKER', 'ADMIN', 'user'],
    example: 'user',
  })
  role: string;

  @ApiProperty({
    description: 'Whether MFA is required (always false for OAuth login)',
    example: false,
  })
  requires_mfa: boolean;

  @ApiProperty({
    description: 'Session tokens',
    type: SessionResponseDto,
  })
  session: SessionResponseDto;
}

/**
 * OAuth Provider Path Parameter
 */
export class OAuthProviderParam {
  @ApiProperty({
    description: 'OAuth provider name',
    enum: OAUTH_PROVIDERS,
    example: 'google',
  })
  @IsIn(OAUTH_PROVIDERS)
  provider: OAuthProvider;
}

/**
 * OAuth User Info (from provider)
 * Internal interface for user data from OAuth providers
 */
export interface OAuthUserInfo {
  email: string;
  name?: string;
  picture?: string;
  sub: string; // Provider's unique identifier for user
  provider: OAuthProvider;
}

/**
 * OAuth Provider Configuration
 * Internal interface for provider settings
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}
