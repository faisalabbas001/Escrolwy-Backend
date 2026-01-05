import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PrismaTransactionClient } from '../../../common/types';
import { ITransferRepository } from './interfaces';

/**
 * Transfer Repository
 *
 * Data access layer for transfer operations
 * Handles transfer intent records (before journal creation)
 * Implements ITransferRepository interface (Dependency Inversion Principle)
 */
@Injectable()
export class TransferRepository implements ITransferRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Prisma client (transaction-aware)
   */
  private getClient(tx?: PrismaTransactionClient): PrismaService | typeof tx {
    return tx || this.prisma;
  }

  /**
   * Create a new transfer
   * Supports transactions via optional tx parameter
   */
  async create(
    data: {
      type: string;
      asset: string;
      amount: number;
      chain: string;
      senderId: string;
      destinationUserId?: string | null;
      destinationAddress?: string | null;
      destinationChain: string;
      status?: string;
      idempotencyKey?: string | null;
      failureReason?: string | null;
    },
    tx?: PrismaTransactionClient,
  ) {
    const client = this.getClient(tx) as any;
    return client.transfer.create({
      data: {
        type: data.type,
        asset: data.asset,
        amount: data.amount,
        chain: data.chain,
        senderId: data.senderId,
        destinationUserId: data.destinationUserId,
        destinationAddress: data.destinationAddress,
        destinationChain: data.destinationChain,
        status: data.status || 'pending',
        idempotencyKey: data.idempotencyKey,
        failureReason: data.failureReason,
      },
    });
  }

  /**
   * Find transfer by ID
   */
  async findById(id: string) {
    return this.prisma.transfer.findUnique({
      where: { id },
      include: {
        journals: {
          include: {
            entries: {
              include: {
                account: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find transfer by idempotency key
   */
  async findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.transfer.findUnique({
      where: { idempotencyKey },
    });
  }

  /**
   * Update transfer status
   * Supports transactions via optional tx parameter
   */
  async updateStatus(
    id: string,
    status: string,
    failureReason?: string | null,
    tx?: PrismaTransactionClient,
  ) {
    const client = this.getClient(tx) as any;
    return client.transfer.update({
      where: { id },
      data: {
        status,
        failureReason,
      },
    });
  }

  /**
   * Find transfers by sender
   */
  async findBySenderId(senderId: string, skip = 0, take = 50) {
    return this.prisma.transfer.findMany({
      where: { senderId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }
}

