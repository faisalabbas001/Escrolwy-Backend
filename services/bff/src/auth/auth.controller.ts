import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Headers,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { ProxyService } from "../proxy";
import { Public } from "../common";

/**
 * Auth Controller (BFF → Auth Service)
 * 
 * Pure HTTP proxy for authentication endpoints.
 * All routes forward requests unchanged to Auth service.
 * All validation (email, password rules, role, acceptTerms, etc.) lives in Auth Service.
 * 
 * Routes:
 * - POST /api/v1/auth/signup - Register new user
 * - POST /api/v1/auth/login - Login with email/password
 * - POST /api/v1/auth/token/refresh - Refresh access token
 * - GET /api/v1/auth/me - Get current user profile
 * - PATCH /api/v1/auth/profile - Update user profile
 * - POST /api/v1/auth/logout - Logout current session
 * - POST /api/v1/auth/logout-all - Logout all sessions
 * - POST /api/v1/auth/2fa/setup - Setup two-factor authentication
 * - POST /api/v1/auth/2fa/disable - Disable two-factor authentication
 * - GET /api/v1/auth/2fa/status - Get 2FA status
 * - POST /api/v1/auth/2fa/backup/consume - Consume 2FA backup code
 * - POST /api/v1/auth/password/forgot - Request password reset
 * - POST /api/v1/auth/password/reset - Reset password with token
 * - POST /api/v1/auth/password/change - Change password (authenticated)
 * - POST /api/v1/auth/oauth/:provider/start - Start OAuth flow
 * - POST /api/v1/auth/oauth/:provider/callback - Handle OAuth callback
 */
@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Register a new user
   * POST /api/v1/auth/signup
   */
  @Public()
  @Post("signup")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User created successfully" })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  async signup(@Body() body: any): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/signup");
    return this.proxyService.proxyToAuth("POST", "/api/v1/auth/signup", body);
  }

  /**
   * Login with email and password
   * POST /api/v1/auth/login
   */
  @Public()
  @Post("login")
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({ status: 200, description: "Login successful" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(@Body() body: any): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/login");
    return this.proxyService.proxyToAuth("POST", "/api/v1/auth/login", body);
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/token/refresh
   */
  @Public()
  @Post("token/refresh")
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({ status: 200, description: "Token refreshed successfully" })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  async refreshToken(@Body() body: any): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/token/refresh");
    return this.proxyService.proxyToAuth(
      "POST",
      "/api/v1/auth/token/refresh",
      body
    );
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  @Get("me")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User profile" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getMe(@Headers("authorization") authHeader: string): Promise<any> {
    this.logger.log("[BFF → Auth] GET /api/v1/auth/me");
    return this.proxyService.proxyToAuth("GET", "/api/v1/auth/me", null, {
      Authorization: authHeader,
    });
  }

  /**
   * Update user profile
   * PATCH /api/v1/auth/profile
   */
  @Patch("profile")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Update user profile" })
  @ApiResponse({ status: 200, description: "Profile updated" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateProfile(
    @Body() body: any,
    @Headers("authorization") authHeader: string
  ): Promise<any> {
    this.logger.log("[BFF → Auth] PATCH /api/v1/auth/profile");
    return this.proxyService.proxyToAuth("PATCH", "/api/v1/auth/profile", body, {
      Authorization: authHeader,
    });
  }

  /**
   * Logout current session
   * POST /api/v1/auth/logout
   */
  @Post("logout")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Logout current session" })
  @ApiResponse({ status: 204, description: "Logged out successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(@Headers("authorization") authHeader: string): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/logout");
    return this.proxyService.proxyToAuth("POST", "/api/v1/auth/logout", null, {
      Authorization: authHeader,
    });
  }

  /**
   * Logout all sessions
   * POST /api/v1/auth/logout-all
   */
  @Post("logout-all")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Logout all sessions" })
  @ApiResponse({ status: 204, description: "All sessions revoked" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logoutAll(@Headers("authorization") authHeader: string): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/logout-all");
    return this.proxyService.proxyToAuth(
      "POST",
      "/api/v1/auth/logout-all",
      null,
      {
        Authorization: authHeader,
      }
    );
  }

  /**
   * Setup two-factor authentication
   * POST /api/v1/auth/2fa/setup
   */
  @Post("2fa/setup")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Setup two-factor authentication" })
  @ApiResponse({ status: 201, description: "2FA setup initiated" })
  @ApiResponse({ status: 400, description: "2FA already enabled" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async setup2FA(@Headers("authorization") authHeader: string): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/2fa/setup");
    return this.proxyService.proxyToAuth("POST", "/api/v1/auth/2fa/setup", null, {
      Authorization: authHeader,
    });
  }

  /**
   * Disable two-factor authentication
   * POST /api/v1/auth/2fa/disable
   */
  @Post("2fa/disable")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Disable two-factor authentication" })
  @ApiResponse({ status: 200, description: "2FA disabled successfully" })
  @ApiResponse({ status: 400, description: "2FA not enabled" })
  @ApiResponse({ status: 401, description: "Invalid token or 2FA code" })
  async disable2FA(
    @Body() body: any,
    @Headers("authorization") authHeader: string
  ): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/2fa/disable");
    return this.proxyService.proxyToAuth("POST", "/api/v1/auth/2fa/disable", body, {
      Authorization: authHeader,
    });
  }

  /**
   * Get two-factor authentication status
   * GET /api/v1/auth/2fa/status
   */
  @Get("2fa/status")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get two-factor authentication status" })
  @ApiResponse({ status: 200, description: "2FA status" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async get2FAStatus(@Headers("authorization") authHeader: string): Promise<any> {
    this.logger.log("[BFF → Auth] GET /api/v1/auth/2fa/status");
    return this.proxyService.proxyToAuth("GET", "/api/v1/auth/2fa/status", null, {
      Authorization: authHeader,
    });
  }

  /**
   * Consume a 2FA backup code
   * POST /api/v1/auth/2fa/backup/consume
   */
  @Post("2fa/backup/consume")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Consume a 2FA backup code" })
  @ApiResponse({ status: 200, description: "Backup code consumed successfully" })
  @ApiResponse({ status: 400, description: "2FA not enabled or no backup codes available" })
  @ApiResponse({ status: 401, description: "Invalid backup code or not authenticated" })
  async consumeBackupCode(
    @Body() body: any,
    @Headers("authorization") authHeader: string
  ): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/2fa/backup/consume");
    return this.proxyService.proxyToAuth(
      "POST",
      "/api/v1/auth/2fa/backup/consume",
      body,
      {
        Authorization: authHeader,
      }
    );
  }

  /**
   * Request password reset
   * POST /api/v1/auth/password/forgot
   */
  @Public()
  @Post("password/forgot")
  @ApiOperation({ summary: "Request password reset" })
  @ApiResponse({ status: 200, description: "Password reset email sent (if email exists)" })
  @ApiResponse({ status: 400, description: "Invalid request" })
  async forgotPassword(@Body() body: any): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/password/forgot");
    return this.proxyService.proxyToAuth("POST", "/api/v1/auth/password/forgot", body);
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/password/reset
   */
  @Public()
  @Post("password/reset")
  @ApiOperation({ summary: "Reset password with token" })
  @ApiResponse({ status: 200, description: "Password reset successfully" })
  @ApiResponse({ status: 400, description: "Invalid or expired token" })
  async resetPassword(@Body() body: any): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/password/reset");
    return this.proxyService.proxyToAuth("POST", "/api/v1/auth/password/reset", body);
  }

  /**
   * Change password (authenticated)
   * POST /api/v1/auth/password/change
   */
  @Post("password/change")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Change password for authenticated user" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 400, description: "Invalid password" })
  async changePassword(
    @Body() body: any,
    @Headers("authorization") authHeader: string
  ): Promise<any> {
    this.logger.log("[BFF → Auth] POST /api/v1/auth/password/change");
    return this.proxyService.proxyToAuth(
      "POST",
      "/api/v1/auth/password/change",
      body,
      {
        Authorization: authHeader,
      }
    );
  }

  /**
   * Start OAuth flow - Generate authorization URL
   * POST /api/v1/auth/oauth/:provider/start
   */
  @Public()
  @Post("oauth/:provider/start")
  @ApiOperation({ summary: "Start OAuth authentication flow" })
  @ApiParam({ name: "provider", description: "OAuth provider (google, etc.)" })
  @ApiResponse({ status: 200, description: "Authorization URL generated successfully" })
  @ApiResponse({ status: 400, description: "Invalid provider or provider not configured" })
  async oauthStart(
    @Param("provider") provider: string,
    @Body() body: any
  ): Promise<any> {
    this.logger.log(`[BFF → Auth] POST /api/v1/auth/oauth/${provider}/start`);
    return this.proxyService.proxyToAuth(
      "POST",
      `/api/v1/auth/oauth/${provider}/start`,
      body
    );
  }

  /**
   * OAuth callback - Handle provider redirect
   * POST /api/v1/auth/oauth/:provider/callback
   */
  @Public()
  @Post("oauth/:provider/callback")
  @ApiOperation({ summary: "Handle OAuth callback" })
  @ApiParam({ name: "provider", description: "OAuth provider (google, etc.)" })
  @ApiResponse({ status: 200, description: "OAuth authentication successful" })
  @ApiResponse({ status: 400, description: "Invalid provider or state mismatch" })
  @ApiResponse({ status: 401, description: "Invalid or expired authorization code" })
  async oauthCallback(
    @Param("provider") provider: string,
    @Body() body: any
  ): Promise<any> {
    this.logger.log(`[BFF → Auth] POST /api/v1/auth/oauth/${provider}/callback`);
    return this.proxyService.proxyToAuth(
      "POST",
      `/api/v1/auth/oauth/${provider}/callback`,
      body
    );
  }
}
