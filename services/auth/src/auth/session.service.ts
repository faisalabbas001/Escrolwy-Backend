import { Injectable, Logger } from '@nestjs/common';
import { SecretsService } from '@escrowly/shared-config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

/**
 * Session data stored in Redis
 */
export interface SessionData {
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  deviceName?: string;
  deviceIp?: string;
  createdAt: string;
  lastUsedAt: string;
  version: number; // For rotation tracking
}

/**
 * Session Service
 *
 * Manages user sessions and refresh tokens in Redis.
 * Implements refresh token rotation with reuse detection.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private redis: Redis;

  // Session TTL: 30 days in seconds
  private readonly SESSION_TTL = 30 * 24 * 60 * 60;

  constructor(private readonly secretsService: SecretsService) {
    const redisUrl = this.secretsService.getRedisUrl() || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    this.redis.on('connect', () => {
      this.logger.log('✅ Connected to Redis');
    });

    this.redis.on('error', (err) => {
      this.logger.error('❌ Redis connection error:', err);
    });
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    sessionId: string,
    refreshToken: string,
    device?: { name?: string; ip?: string },
  ): Promise<SessionData> {
    const refreshTokenHash = this.hashToken(refreshToken);
    const now = new Date().toISOString();

    const session: SessionData = {
      sessionId,
      userId,
      refreshTokenHash,
      deviceName: device?.name,
      deviceIp: device?.ip,
      createdAt: now,
      lastUsedAt: now,
      version: 1,
    };

    // Store session
    const sessionKey = this.getSessionKey(sessionId);
    await this.redis.setex(
      sessionKey,
      this.SESSION_TTL,
      JSON.stringify(session),
    );

    // Add session to user's session list
    const userSessionsKey = this.getUserSessionsKey(userId);
    await this.redis.sadd(userSessionsKey, sessionId);
    await this.redis.expire(userSessionsKey, this.SESSION_TTL);

    this.logger.debug(`Created session ${sessionId} for user ${userId}`);
    return session;
  }

  /**
   * Validate and rotate refresh token
   * Returns new session data if valid, null if invalid or reused
   */
  async rotateRefreshToken(
    sessionId: string,
    oldRefreshToken: string,
    newRefreshToken: string,
    device?: { name?: string; ip?: string },
  ): Promise<SessionData | null> {
    const sessionKey = this.getSessionKey(sessionId);
    const sessionData = await this.redis.get(sessionKey);

    if (!sessionData) {
      this.logger.warn(`Session ${sessionId} not found`);
      return null;
    }

    const session: SessionData = JSON.parse(sessionData);
    const oldTokenHash = this.hashToken(oldRefreshToken);

    // Check if token matches
    if (session.refreshTokenHash !== oldTokenHash) {
      // Reuse detected! Revoke entire session family
      this.logger.warn(`Refresh token reuse detected for session ${sessionId}`);
      await this.revokeAllUserSessions(session.userId);
      return null;
    }

    // Update session with new token
    const now = new Date().toISOString();
    const newTokenHash = this.hashToken(newRefreshToken);

    const updatedSession: SessionData = {
      ...session,
      refreshTokenHash: newTokenHash,
      deviceName: device?.name || session.deviceName,
      deviceIp: device?.ip || session.deviceIp,
      lastUsedAt: now,
      version: session.version + 1,
    };

    await this.redis.setex(
      sessionKey,
      this.SESSION_TTL,
      JSON.stringify(updatedSession),
    );

    this.logger.debug(
      `Rotated refresh token for session ${sessionId}, version ${updatedSession.version}`,
    );
    return updatedSession;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const sessionKey = this.getSessionKey(sessionId);
    const sessionData = await this.redis.get(sessionKey);

    if (!sessionData) {
      return null;
    }

    return JSON.parse(sessionData);
  }

  /**
   * Revoke a single session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const sessionKey = this.getSessionKey(sessionId);
    await this.redis.del(sessionKey);

    const userSessionsKey = this.getUserSessionsKey(session.userId);
    await this.redis.srem(userSessionsKey, sessionId);

    this.logger.debug(`Revoked session ${sessionId}`);
    return true;
  }

  /**
   * Revoke all sessions for a user (logout-all)
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionIds = await this.redis.smembers(userSessionsKey);

    if (sessionIds.length === 0) {
      return 0;
    }

    // Delete all session keys
    const sessionKeys = sessionIds.map((id) => this.getSessionKey(id));
    await this.redis.del(...sessionKeys);

    // Clear the user's session set
    await this.redis.del(userSessionsKey);

    this.logger.debug(
      `Revoked ${sessionIds.length} sessions for user ${userId}`,
    );
    return sessionIds.length;
  }

  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get Redis key for a session
   */
  private getSessionKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  /**
   * Get Redis key for a user's session list
   */
  private getUserSessionsKey(userId: string): string {
    return `auth:user_sessions:${userId}`;
  }
}
