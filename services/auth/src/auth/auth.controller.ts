import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Public } from '@escrowly/auth-common';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { JwtService } from './jwt.service';
import {
  SignupDto,
  LoginDto,
  RefreshTokenDto,
  SignupResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  TwoFactorDisableDto,
  TwoFactorSetupResponseDto,
  TwoFactorDisableResponseDto,
  TwoFactorStatusResponseDto,
  TwoFactorBackupCodeConsumeDto,
  TwoFactorBackupCodeConsumeResponseDto,
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordDto,
  ResetPasswordResponseDto,
  ChangePasswordDto,
  ChangePasswordResponseDto,
  UpdateProfileDto,
  UpdateProfileResponseDto,
  OAuthStartDto,
  OAuthStartResponseDto,
  OAuthCallbackDto,
  OAuthCallbackResponseDto,
  OAuthProvider,
  OAUTH_PROVIDERS,
} from './dto';

/**
 * Auth Controller
 *
 * Public authentication endpoints:
 * - POST /auth/signup - Register new user
 * - POST /auth/login - Login with email/password
 * - POST /auth/token/refresh - Refresh access token
 * - POST /auth/logout - Logout current session
 * - POST /auth/logout-all - Logout all sessions
 */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user
   */
  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: SignupResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async signup(@Body() dto: SignupDto): Promise<SignupResponseDto> {
    this.logger.log(`Signup request for: ${dto.email}`);
    return this.authService.signup(dto);
  }

  /**
   * Login with email and password
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    this.logger.log(`Login request for: ${dto.email}`);
    return this.authService.login(dto);
  }

  /**
   * Refresh access token
   */
  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: RefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<RefreshResponseDto> {
    this.logger.log('Token refresh request');
    return this.authService.refreshToken(dto.refreshToken, dto.device);
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMe(@Headers('authorization') authHeader: string): Promise<any> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.authService.getUserById(payload.sub);
    return {
      user_id: user.id,
      email: user.email,
      role: user.role,
      status: user.isActive ? 'ACTIVE' : 'DISABLED',
      kyc: user.kycStatus
        ? {
        state: user.kycStatus.state,
        updated_at: user.kycStatus.updatedAt,
          }
        : null,
      profile: user.profile,
    };
  }

  /**
   * Update user profile
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UpdateProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async updateProfile(
    @Headers('authorization') authHeader: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UpdateProfileResponseDto> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.updateUserProfile(payload.sub, dto);
  }

  /**
   * Logout current session
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async logout(@Headers('authorization') authHeader: string): Promise<void> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    await this.authService.logout(payload.sessionId);
    this.logger.log(`Logout for session: ${payload.sessionId}`);
  }

  /**
   * Logout all sessions
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout all sessions for the user' })
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async logoutAll(@Headers('authorization') authHeader: string): Promise<void> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    const count = await this.authService.logoutAll(payload.sub);
    this.logger.log(
      `Logout-all for user ${payload.sub}: ${count} sessions revoked`,
    );
  }

  // ====================================
  // Two-Factor Authentication Endpoints
  // ====================================

  /**
   * Setup 2FA - generates QR code for authenticator app
   * Secret and otpauthUrl are kept server-side for security
   */
  @Post('2fa/setup')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Setup two-factor authentication',
    description: 'Generates a QR code for scanning with an authenticator app. The secret is stored securely on the server and never exposed to the client.'
  })
  @ApiResponse({
    status: 201,
    description: 'Returns QR code data URL only',
    type: TwoFactorSetupResponseDto,
  })
  @ApiResponse({ status: 400, description: '2FA already enabled' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async setup2FA(
    @Headers('authorization') authHeader: string,
  ): Promise<TwoFactorSetupResponseDto> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.setup2FA(payload.sub);
  }

  /**
   * Disable 2FA
   */
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  @ApiResponse({
    status: 200,
    description: '2FA disabled successfully',
    type: TwoFactorDisableResponseDto,
  })
  @ApiResponse({ status: 400, description: '2FA not enabled' })
  @ApiResponse({ status: 401, description: 'Invalid token or 2FA code' })
  async disable2FA(
    @Headers('authorization') authHeader: string,
    @Body() dto: TwoFactorDisableDto,
  ): Promise<TwoFactorDisableResponseDto> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.disable2FA(payload.sub, dto.code);
  }

  /**
   * Get 2FA status
   */
  @Get('2fa/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get two-factor authentication status' })
  @ApiResponse({
    status: 200,
    description: 'Returns 2FA status',
    type: TwoFactorStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async get2FAStatus(
    @Headers('authorization') authHeader: string,
  ): Promise<TwoFactorStatusResponseDto> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.authService.get2FAStatus(payload.sub);
  }

  /**
   * Consume a 2FA backup code
   * Used when user cannot access their authenticator app
   */
  @Post('2fa/backup/consume')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Consume a 2FA backup code',
    description: 'Use a backup code when you cannot access your authenticator app. Each code is single-use.'
  })
  @ApiResponse({
    status: 200,
    description: 'Backup code consumed successfully',
    type: TwoFactorBackupCodeConsumeResponseDto,
  })
  @ApiResponse({ status: 400, description: '2FA not enabled or no backup codes available' })
  @ApiResponse({ status: 401, description: 'Invalid backup code or not authenticated' })
  async consumeBackupCode(
    @Headers('authorization') authHeader: string,
    @Body() dto: TwoFactorBackupCodeConsumeDto,
  ): Promise<TwoFactorBackupCodeConsumeResponseDto> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    await this.authService.consumeBackupCode(payload.sub, dto.code);

    return { ok: true };
  }

  // ====================================
  // Password Reset Endpoints
  // ====================================

  /**
   * Request password reset
   */
  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent (if email exists)',
    type: ForgotPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    this.logger.log(`Password reset request for: ${dto.email}`);
    return this.authService.forgotPassword(dto.email);
  }

  /**
   * Reset password with token
   */
  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    this.logger.log('Password reset with token');
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  /**
   * Change password (authenticated)
   */
  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: ChangePasswordResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  async changePassword(
    @Headers('authorization') authHeader: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    const token = this.extractToken(authHeader);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    this.logger.log(`Password change request for user: ${payload.sub}`);
    return this.authService.changePassword(
      payload.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ====================================
  // OAuth Authentication Endpoints
  // ====================================

  /**
   * Start OAuth flow - Generate authorization URL
   * Redirects user to OAuth provider for authentication
   */
  @Public()
  @Post('oauth/:provider/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start OAuth authentication flow',
    description: 'Generates authorization URL for the specified OAuth provider. Client should redirect user to this URL.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider',
    enum: OAUTH_PROVIDERS,
    example: 'google',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL generated successfully',
    type: OAuthStartResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid provider or provider not configured' })
  async oauthStart(
    @Param('provider') provider: string,
    @Body() dto: OAuthStartDto,
  ): Promise<OAuthStartResponseDto> {
    // Validate provider
    if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
      throw new BadRequestException(
        `Invalid OAuth provider: ${provider}. Supported providers: ${OAUTH_PROVIDERS.join(', ')}`,
      );
    }

    this.logger.log(`OAuth start request for provider: ${provider}`);
    return this.oauthService.startOAuth(provider as OAuthProvider, dto);
  }

  /**
   * OAuth callback - Handle provider redirect
   * Exchanges authorization code for tokens and creates user session
   */
  @Public()
  @Post('oauth/:provider/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle OAuth callback',
    description: 'Exchanges authorization code for access token, fetches user info, and creates session. Response format matches /auth/login.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider',
    enum: OAUTH_PROVIDERS,
    example: 'google',
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth authentication successful',
    type: OAuthCallbackResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid provider or state mismatch' })
  @ApiResponse({ status: 401, description: 'Invalid or expired authorization code' })
  async oauthCallback(
    @Param('provider') provider: string,
    @Body() dto: OAuthCallbackDto,
  ): Promise<OAuthCallbackResponseDto> {
    // Validate provider
    if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
      throw new BadRequestException(
        `Invalid OAuth provider: ${provider}. Supported providers: ${OAUTH_PROVIDERS.join(', ')}`,
      );
    }

    this.logger.log(`OAuth callback for provider: ${provider}`);
    return this.oauthService.handleCallback(provider as OAuthProvider, dto);
  }

  /**
   * Extract token from Authorization header
   */
  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }
    return authHeader.substring(7);
  }
}
