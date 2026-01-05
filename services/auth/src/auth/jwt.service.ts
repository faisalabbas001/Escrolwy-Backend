import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * Access token payload
 */
export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  role: string;
  sessionId: string;
  type: 'access';
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  sub: string; // User ID
  sessionId: string;
  type: 'refresh';
  jti: string; // Unique token ID for rotation tracking
}

/**
 * JWT Service
 *
 * Handles JWT token generation and verification
 */
@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly accessTokenExpirySeconds: number;
  private readonly refreshTokenExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'default-secret-change-me',
    );
    this.accessTokenExpiry = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_EXPIRY',
      '15m',
    );
    this.refreshTokenExpiry = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRY',
      '30d',
    );

    // Parse expiry to seconds
    this.accessTokenExpirySeconds = this.parseExpiryToSeconds(
      this.accessTokenExpiry,
    );
    this.refreshTokenExpirySeconds = this.parseExpiryToSeconds(
      this.refreshTokenExpiry,
    );

    if (this.jwtSecret === 'default-secret-change-me') {
      this.logger.warn(
        '⚠️ Using default JWT secret. Set JWT_SECRET in production!',
      );
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(
    userId: string,
    email: string,
    role: string,
    sessionId: string,
  ): string {
    const payload: AccessTokenPayload = {
      sub: userId,
      email,
      role,
      sessionId,
      type: 'access',
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpirySeconds,
      issuer: 'escrowly-auth',
      audience: 'escrowly',
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string, sessionId: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      sessionId,
      type: 'refresh',
      jti: uuidv4(), // Unique ID for this refresh token
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpirySeconds,
      issuer: 'escrowly-auth',
      audience: 'escrowly',
    });
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: 'escrowly-auth',
        audience: 'escrowly',
      }) as AccessTokenPayload;

      if (payload.type !== 'access') {
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.debug(`Access token verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: 'escrowly-auth',
        audience: 'escrowly',
      }) as RefreshTokenPayload;

      if (payload.type !== 'refresh') {
        return null;
      }

      return payload;
    } catch (error) {
      this.logger.debug(`Refresh token verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get access token expiry in seconds
   */
  getAccessTokenExpirySeconds(): number {
    return this.accessTokenExpirySeconds;
  }

  /**
   * Get refresh token expiry in seconds
   */
  getRefreshTokenExpirySeconds(): number {
    return this.refreshTokenExpirySeconds;
  }

  /**
   * Generate impersonation token (admin impersonating user)
   */
  generateImpersonationToken(
    userId: string,
    email: string,
    role: string,
    adminId: string,
  ): string {
    const payload = {
      sub: userId,
      email,
      role,
      type: 'impersonation',
      adminId, // Track which admin is impersonating
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: 900, // 15 minutes
      issuer: 'escrowly-auth',
      audience: 'escrowly',
    });
  }

  /**
   * Generate service-to-service token
   */
  generateServiceToken(
    aud: string,
    scopes: string[],
    ttl: number = 600,
  ): string {
    const payload = {
      type: 's2s',
      scopes,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: ttl,
      issuer: 'escrowly-auth',
      audience: aud,
    });
  }

  /**
   * Validate any token and return payload
   */
  validateToken(token: string): any | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        issuer: 'escrowly-auth',
      });
      return payload;
    } catch (error) {
      this.logger.debug(`Token validation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }
}
