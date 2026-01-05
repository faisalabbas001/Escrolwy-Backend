import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PrismaTransactionClient } from '../../../common/types';
import { IJournalRepository } from './interfaces';
import { Prisma } from '../../../../../../generated/prisma';

/**
 * Journal Repository
 *
 * Data access layer for journal operations
 * Handles "why money moved" records (created after validation)
 * Implements IJournalRepository interface (Dependency Inversion Principle)
 */
@Injectable()
export class JournalRepository implements IJournalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Prisma client (transaction-aware)
   */
  private getClient(tx?: PrismaTransactionClient): PrismaService | typeof tx {
    return tx || this.prisma;
  }

  /**
   * Create a new journal
   * Supports transactions via optional tx parameter
   * transferId is optional (null for deposits that don't create transfer records)
   */
  async create(
    data: {
      type: string;
      asset: string;
      chain: string;
      userId: string;
      transferId?: string | null;
      idempotencyKey?: string | null;
    },
    tx?: PrismaTransactionClient,
  ) {
    const client = this.getClient(tx);
    
    // Use JournalUncheckedCreateInput to set foreign key directly
    // This allows us to set transferId to null without Prisma expecting a relation object
    const createData: Prisma.JournalUncheckedCreateInput = {
      type: data.type,
      asset: data.asset,
      chain: data.chain,
      userId: data.userId,
      idempotencyKey: data.idempotencyKey ?? null,
      transferId: data.transferId ?? null,
    };

    return client.journal.create({
      data: createData,
    });
  }

  /**
   * Find journal by ID
   */
  async findById(id: string) {
    return this.prisma.journal.findUnique({
      where: { id },
      include: {
        transfer: true,
        entries: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  /**
   * Find journal by idempotency key
   */
  async findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.journal.findUnique({
      where: { idempotencyKey },
    });
  }

  /**
   * Find journals by transfer ID
   */
  async findByTransferId(transferId: string) {
    return this.prisma.journal.findMany({
      where: { transferId },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
    });
  }
}

