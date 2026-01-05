import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PrismaTransactionClient } from '../../../common/types';

/**
 * Reservation Repository
 *
 * Single Responsibility: Data access for reservations
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class ReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Prisma client (transaction-aware)
   */
  private getClient(tx?: PrismaTransactionClient): PrismaService | typeof tx {
    return tx || this.prisma;
  }

  /**
   * Create a new reservation
   */
  async create(
    data: {
      userId: string;
      amount: number;
      asset: string;
      chain: string;
      reference: string;
      status?: string;
      transferId?: string | null;
      idempotencyKey?: string | null;
    },
    tx?: PrismaTransactionClient,
  ) {
    const client = this.getClient(tx) as any;
    return client.reservation.create({
      data: {
        userId: data.userId,
        amount: data.amount,
        asset: data.asset,
        chain: data.chain,
        reference: data.reference,
        status: data.status || 'reserved',
        transferId: data.transferId,
        idempotencyKey: data.idempotencyKey,
      },
    });
  }

  /**
   * Find reservation by ID
   */
  async findById(id: string) {
    return this.prisma.reservation.findUnique({
      where: { id },
    });
  }

  /**
   * Find reservation by idempotency key
   */
  async findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.reservation.findUnique({
      where: { idempotencyKey },
    });
  }

  /**
   * Update reservation status
   */
  async updateStatus(
    id: string,
    status: string,
    transferId?: string | null,
    tx?: PrismaTransactionClient,
  ) {
    const client = this.getClient(tx) as any;
    return client.reservation.update({
      where: { id },
      data: {
        status,
        transferId,
      },
    });
  }

  /**
   * Find reservations by user ID
   */
  async findByUserId(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find reservations by reference (e.g., escrow_id)
   */
  async findByReference(reference: string) {
    return this.prisma.reservation.findMany({
      where: { reference },
      orderBy: { createdAt: 'desc' },
    });
  }
}

