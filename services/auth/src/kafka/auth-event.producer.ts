import { Injectable, Logger } from '@nestjs/common';
import {
  AuthTopics,
  UserCreatedPayload,
  UserLockedPayload,
  UserUnlockedPayload,
  UserRoleChangedPayload,
  UserKycStateChangedPayload,
  SessionCreatedPayload,
  SessionRevokedPayload,
  PasswordResetRequestedPayload,
  PasswordChangedPayload,
} from '@escrowly/kafka-core';
import { OutboxRepository } from '../auth/repository';

/**
 * Auth Event Producer
 *
 * Produces Kafka events for auth state changes using the Transactional Outbox Pattern.
 * Events are written to the outbox table and published to Kafka by OutboxProcessorService.
 * All methods are fire-and-forget - failures are logged but don't block.
 *
 * Architecture matches Escrow Service pattern for consistency.
 */
@Injectable()
export class AuthEventProducer {
  private readonly logger = new Logger(AuthEventProducer.name);

  constructor(private readonly outboxRepository: OutboxRepository) {}

  // ==========================================
  // USER EVENTS
  // ==========================================

  /**
   * Emit user.created event
   */
  async userCreated(
    userId: string,
    email: string,
    role: string,
    displayName?: string,
  ): Promise<void> {
    const payload: UserCreatedPayload = {
      userId,
      email,
      role,
      displayName,
      createdAt: new Date().toISOString(),
    };

    await this.produce(AuthTopics.USER_CREATED, userId, payload);
  }

  /**
   * Emit user.locked event
   */
  async userLocked(
    userId: string,
    byAdmin: string,
    reason?: string,
  ): Promise<void> {
    const payload: UserLockedPayload = {
      userId,
      byAdmin,
      reason: reason || null,
      at: new Date().toISOString(),
    };

    await this.produce(AuthTopics.USER_LOCKED, userId, payload);
  }

  /**
   * Emit user.unlocked event
   */
  async userUnlocked(
    userId: string,
    byAdmin: string,
    reason?: string,
  ): Promise<void> {
    const payload: UserUnlockedPayload = {
      userId,
      byAdmin,
      reason: reason || null,
      at: new Date().toISOString(),
    };

    await this.produce(AuthTopics.USER_UNLOCKED, userId, payload);
  }

  /**
   * Emit user.role_changed event
   */
  async userRoleChanged(
    userId: string,
    oldRole: string,
    newRole: string,
    byAdmin: string,
  ): Promise<void> {
    const payload: UserRoleChangedPayload = {
      userId,
      oldRole,
      newRole,
      byAdmin,
      at: new Date().toISOString(),
    };

    await this.produce(AuthTopics.USER_ROLE_CHANGED, userId, payload);
  }

  /**
   * Emit user.kyc_state_changed event
   */
  async userKycStateChanged(
    userId: string,
    oldState: string,
    newState: string,
    provider: string = 'manual',
  ): Promise<void> {
    const payload: UserKycStateChangedPayload = {
      userId,
      oldState,
      newState,
      provider,
      at: new Date().toISOString(),
    };

    await this.produce(AuthTopics.USER_KYC_STATE_CHANGED, userId, payload);
  }

  // ==========================================
  // SESSION EVENTS
  // ==========================================

  /**
   * Emit session.created event
   */
  async sessionCreated(
    sessionId: string,
    userId: string,
    email: string,
    device?: { name?: string; ip?: string; userAgent?: string },
  ): Promise<void> {
    const payload: SessionCreatedPayload = {
      sessionId,
      userId,
      email,
      device,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await this.produce(AuthTopics.SESSION_CREATED, userId, payload);
  }

  /**
   * Emit session.revoked event
   */
  async sessionRevoked(
    sessionId: string,
    userId: string,
    reason: string = 'user_logout',
  ): Promise<void> {
    const payload: SessionRevokedPayload = {
      sessionId,
      userId,
      reason,
      revokedAt: new Date().toISOString(),
    };

    await this.produce(AuthTopics.SESSION_REVOKED, userId, payload);
  }

  // ==========================================
  // PASSWORD EVENTS
  // ==========================================

  /**
   * Emit password.reset.requested event
   * This event will be consumed by Notification Service to send email
   */
  async passwordResetRequested(
    userId: string,
    email: string,
    resetToken: string,
    expiresAt: Date,
  ): Promise<void> {
    const payload: PasswordResetRequestedPayload = {
      userId,
      email,
      resetToken,
      expiresAt: expiresAt.toISOString(),
      requestedAt: new Date().toISOString(),
    };

    await this.produce(AuthTopics.PASSWORD_RESET_REQUESTED, userId, payload);
  }

  /**
   * Emit password.changed event
   * This event will be consumed by Notification Service to send confirmation email
   */
  async passwordChanged(
    userId: string,
    email: string,
    reason: 'reset' | 'user_change' = 'user_change',
  ): Promise<void> {
    const payload: PasswordChangedPayload = {
      userId,
      email,
      changedAt: new Date().toISOString(),
      reason,
    };

    await this.produce(AuthTopics.PASSWORD_CHANGED, userId, payload);
  }

  // ==========================================
  // CORE PRODUCE METHOD
  // ==========================================

  /**
   * Save event to outbox table (Transactional Outbox Pattern).
   * OutboxProcessorService will pick it up and publish to Kafka.
   * Never publishes directly to Kafka - this ensures transactional consistency.
   */
  private async produce<T>(
    topic: AuthTopics,
    partitionKey: string,
    payload: T,
  ): Promise<void> {
    try {
      // Save to outbox with 'pending' status
      // OutboxProcessorService will poll and publish to Kafka
      await this.outboxRepository.save(topic, partitionKey, payload, undefined, 'pending');
      this.logger.debug(`Saved ${topic} to outbox for ${partitionKey}`);
    } catch (error: any) {
      // Log but don't throw - event production shouldn't block business logic
      this.logger.error(
        `Failed to save ${topic} to outbox for ${partitionKey}: ${error.message}`,
        error.stack,
      );
    }
  }
}
