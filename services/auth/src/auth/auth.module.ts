import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { UserStatusChecker } from './user-status.checker';
import { ServiceAuthGuard } from '../guards/service-auth.guard';

/**
 * Auth Module
 *
 * Provides authentication functionality:
 * - Signup
 * - Login
 * - OAuth (Google, GitHub, Apple)
 * - Token refresh
 * - Logout
 * - Password reset (via Kafka events)
 * - User status checking (for StatusGuard)
 *
 * OAuth Endpoints:
 * - POST /auth/oauth/:provider/start - Start OAuth flow
 * - POST /auth/oauth/:provider/callback - Handle OAuth callback
 *
 * Note: Email sending has been removed from this service.
 * Password reset and change events are now published to Kafka
 * and consumed by the Notification Service.
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OAuthService,
    JwtService,
    SessionService,
    UserStatusChecker,
    ServiceAuthGuard,
  ],
  exports: [
    AuthService,
    OAuthService,
    JwtService,
    SessionService,
    UserStatusChecker,
    ServiceAuthGuard,
  ],
})
export class AuthModule {}
