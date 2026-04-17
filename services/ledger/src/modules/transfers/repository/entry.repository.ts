import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { PrismaTransactionClient } from '../../../common/types';
import { IEntryRepository } from './interfaces';

/**
 * Entry Repository
 *
 * Data access layer for entry operations
 * Handles "how money moved" records (debits & credits)
 * Implements IEntryRepository interface (Dependency Inversion Principle)
 */
@Injectable()
export class EntryRepository implements IEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Prisma client (transaction-aware)
   */
  private getClient(tx?: PrismaTransactionClient): PrismaService | typeof tx {
    return tx || this.prisma;
  }

  /**
   * Create multiple entries in a transaction
   * Ensures double-entry accounting (sum of amounts = 0)
   * Supports transactions via optional tx parameter
   */
  async createMany(
    entries: Array<{ journalId: string; accountId: string; amount: number }>,
    tx?: PrismaTransactionClient,
  ) {
    // Validate double-entry: sum must be zero
    const sum = entries.reduce((acc, entry) => acc + entry.amount, 0);
    if (Math.abs(sum) > 0.000001) {
      // Allow tiny floating point differences
      throw new Error(
        `Double-entry validation failed: entries sum to ${sum}, must be 0`,
      );
    }

    const client = this.getClient(tx) as any;
    return client.entry.createMany({
      data: entries.map((entry) => ({
        journalId: entry.journalId,
        accountId: entry.accountId,
        amount: entry.amount,
      })),
    });
  }

  /**
   * Find entries by journal ID
   */
  async findByJournalId(journalId: string) {
    return this.prisma.entry.findMany({
      where: { journalId },
      include: {
        account: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find entries by account ID
   */
  async findByAccountId(accountId: string, skip = 0, take = 100) {
    return this.prisma.entry.findMany({
      where: { accountId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        journal: {
          include: {
            transfer: true,
          },
        },
      },
    });
  }

  /**
   * Calculate sum of entries for a journal (should always be 0)
   */
  async sumByJournalId(journalId: string): Promise<number> {
    const result = await this.prisma.entry.aggregate({
      where: { journalId },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount ? parseFloat(result._sum.amount.toString()) : 0;
  }
}

