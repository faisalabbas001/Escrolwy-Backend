import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload, AuthUser } from '../interfaces';

/**
 * JWT Authentication Guard
 *
 * Validates JWT access tokens and attaches user to request.
 * Respects @Public() decorator to skip authentication.
 *
 * @example
 * ```typescript
 * // Apply globally in main.ts
 * app.useGlobalGuards(new JwtAuthGuard(reflector, configService));
 *
 * // Or apply at controller level
 * @UseGuards(JwtAuthGuard)
 * @Controller('escrows')
 * export class EscrowController {}
 *
 * // Or apply at route level
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * protectedRoute() {}
 * ```
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly jwtSecret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'default-secret-change-me',
    );
    this.issuer = this.configService.get<string>(
      'JWT_ISSUER',
      'escrowly-auth',
    );
    this.audience = this.configService.get<string>(
      'JWT_AUDIENCE',
      'escrowly',
    );

    if (this.jwtSecret === 'default-secret-change-me') {
      this.logger.warn(
        '⚠️ Using default JWT secret. Set JWT_SECRET in production!',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Exclude Swagger documentation paths from authentication
    const path = request.url || request.path || '';
    if (path.startsWith('/api/docs') || path.startsWith('/docs')) {
      return true;
    }
    
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn(`[Guard] No token extracted. Headers: ${JSON.stringify(Object.keys(request.headers || {}))}`);
      throw new UnauthorizedException('Access token is required');
    }

    try {
      const payload = this.verifyToken(token);
      
      this.logger.debug(`[Guard] Token verified successfully for user: ${payload?.sub || 'unknown'}`);
      
      if (!payload) {
        throw new UnauthorizedException('Invalid access token');
      }

      // Attach user to request
      const user: AuthUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sessionId,
      };

      request.user = user;
      
      return true;
    } catch (error) {
      this.logger.debug(`Token verification failed: ${error.message}`);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired');
      }

      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid access token');
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractTokenFromHeader(request: any): string | null {
    
    // Check both lowercase and capital A (Express normalizes to lowercase, but check both for safety)
    const authHeader = request.headers?.authorization || request.headers?.Authorization;
    
    if (!authHeader) {
      this.logger.debug(`[extractTokenFromHeader] No authorization header found. Available headers: ${Object.keys(request.headers || {}).join(', ')}`);
      return null;
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      this.logger.debug(`[extractTokenFromHeader] Invalid token format. Type: ${type}, Has token: ${!!token}`);
      return null;
    }

    return token;
  }

  /**
   * Verify JWT token and return payload
   */
  private verifyToken(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as JwtPayload;

      // Ensure it's an access token
      if (payload.type !== 'access') {
        return null;
      }

      return payload;
    } catch (error) {
      throw error;
    }
  }
}

