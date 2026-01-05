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

/**
 * JWT payload structure (issued by Auth service)
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  sessionId: string;
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * JWT Auth Guard
 * 
 * Validates JWT tokens issued by Auth service.
 * Public routes (marked with @Public()) bypass validation.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET', 'default-secret');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();
    const route = `${controller.name}.${handler.name}`;
    const path = request.url;

    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      handler,
      controller,
    ]);

    if (isPublic) {
      this.logger.debug(`[Guard] Public route accessed: ${path}`);
      return true;
    }

    // Protected route - require authentication
    this.logger.debug(`[Guard] Protected route accessed: ${path} (${route})`);
    
    const token = this.extractToken(request);

    if (!token) {
      this.logger.warn(`[Guard] No token provided for protected route: ${path}`);
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: 'escrowly-auth',
        audience: 'escrowly',
      }) as JwtPayload;

      // Validate token type
      if (payload.type !== 'access') {
        this.logger.warn(`[Guard] Invalid token type for route: ${path}`);
        throw new UnauthorizedException('Invalid token type');
      }

      // Attach user info to request
      request.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sessionId,
      };

      this.logger.debug(`[Guard] Authenticated user: ${payload.email} (${payload.role}) for route: ${path}`);
      return true;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn(`[Guard] Expired token for route: ${path}`);
        throw new UnauthorizedException('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        this.logger.warn(`[Guard] Invalid token for route: ${path} - ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }
      this.logger.error(`[Guard] Authentication failed for route: ${path}`, error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

