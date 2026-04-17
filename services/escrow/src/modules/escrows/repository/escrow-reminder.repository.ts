import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { EscrowReminderEntity } from '../entities/escrow.entity';

/**
 * Escrow Reminder Repository
 *
 * Data access layer for escrow reminder tracking
 * Used for idempotency - prevents sending duplicate reminders
 */
@Injectable()
export class EscrowReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a reminder record
   */
  async create(
    escrowId: string,
    type: string,
    scheduledAt: Date,
    metadata?: Record<string, any>,
  ): Promise<EscrowReminderEntity> {
    return this.prisma.escrowReminder.create({
      data: {
        escrowId,
        type,
        scheduledAt,
        metadata,
      },
    }) as Promise<EscrowReminderEntity>;
  }

  /**
   * Find recent reminder by escrow ID and type
   * Used for idempotency - check if reminder was sent recently
   */
  async findRecentByEscrowAndType(
    escrowId: string,
    type: string,
    withinHours: number,
  ): Promise<EscrowReminderEntity | null> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - withinHours);

    const reminder = await this.prisma.escrowReminder.findFirst({
      where: {
        escrowId,
        type,
        sentAt: {
          gte: cutoffDate,
        },
      },
      orderBy: { sentAt: 'desc' },
    });

    return reminder as EscrowReminderEntity | null;
  }

  /**
   * Mark reminder as sent
   */
  async markAsSent(
    id: string,
    metadata?: Record<string, any>,
  ): Promise<EscrowReminderEntity> {
    const existing = await this.prisma.escrowReminder.findUnique({
      where: { id },
    });

    return this.prisma.escrowReminder.update({
      where: { id },
      data: {
        sentAt: new Date(),
        metadata: metadata
          ? {
              ...((existing as any)?.metadata || {}),
              ...metadata,
            }
          : undefined,
      },
    }) as Promise<EscrowReminderEntity>;
  }

  /**
   * Create and mark as sent in one transaction
   * Useful for immediate reminder tracking
   */
  async createAndMarkAsSent(
    escrowId: string,
    type: string,
    metadata?: Record<string, any>,
  ): Promise<EscrowReminderEntity> {
    return this.prisma.escrowReminder.create({
      data: {
        escrowId,
        type,
        scheduledAt: new Date(),
        sentAt: new Date(),
        metadata,
      },
    }) as Promise<EscrowReminderEntity>;
  }
}

