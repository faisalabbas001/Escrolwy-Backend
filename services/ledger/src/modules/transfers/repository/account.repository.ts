import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { Decimal } from '../../../../../../generated/prisma/runtime/library';
import { PrismaTransactionClient } from '../../../common/types';
import { IAccountRepository } from './interfaces';

/**
 * Account Repository
 *
 * Data access layer for account operations
 * Handles balance buckets (spendable, reserved, treasury, fees)
 * Implements IAccountRepository interface (Dependency Inversion Principle)
 */
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Prisma client (transaction-aware)
   */
  private getClient(tx?: PrismaTransactionClient): PrismaService | typeof tx {
    return tx || this.prisma;
  }

  /**
   * Find or create account
   * Ensures account exists for given owner, asset, chain, and purpose
   * Supports transactions via optional tx parameter
   */
  async findOrCreate(
    params: {
      ownerType: string;
      ownerId: string | null;
      asset: string;
      chain: string;
      purpose: string;
    },
    tx?: PrismaTransactionClient,
  ) {
    const normalizedOwnerId =
      params.ownerType === 'platform' && !params.ownerId ? 'platform' : params.ownerId;

    const client = this.getClient(tx) as any;
    return client.account.upsert({
      where: {
        ownerType_ownerId_asset_chain_purpose: {
          ownerType: params.ownerType,
          ownerId: normalizedOwnerId,
          asset: params.asset,
          chain: params.chain,
          purpose: params.purpose,
        },
      },
      create: {
        ownerType: params.ownerType,
        ownerId: normalizedOwnerId,
        asset: params.asset,
        chain: params.chain,
        purpose: params.purpose,
      },
      update: {},
    });
  }

  /**
   * Find account by ID
   */
  async findById(id: string) {
    return this.prisma.account.findUnique({
      where: { id },
      include: {
        entries: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Recent entries for debugging
        },
      },
    });
  }

  /**
   * Find account by owner, asset, chain, and purpose
   */
  async findByOwnerAndPurpose(params: {
    ownerType: string;
    ownerId: string | null;
    asset: string;
    chain: string;
    purpose: string;
  }) {
    return this.prisma.account.findUnique({
      where: {
        ownerType_ownerId_asset_chain_purpose: {
          ownerType: params.ownerType,
          ownerId: params.ownerId,
          asset: params.asset,
          chain: params.chain,
          purpose: params.purpose,
        },
      },
    });
  }

  /**
   * Calculate account balance by summing all entries
   * Supports transactions via optional tx parameter
   */
  async getBalance(accountId: string, tx?: PrismaTransactionClient): Promise<number> {
    const client = this.getClient(tx) as any;
    const result = await client.entry.aggregate({
      where: { accountId },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount
      ? parseFloat(result._sum.amount.toString())
      : 0;
  }

  /**
   * Get all accounts for a user
   */
  async findByUserId(userId: string) {
    return this.prisma.account.findMany({
      where: {
        ownerType: 'user',
        ownerId: userId,
      },
    });
  }

  /**
   * Get all balances for a user (with calculated balances)
   */
  async getUserBalances(userId: string) {
    const accounts = await this.findByUserId(userId);
    const balances = await Promise.all(
      accounts.map(async (account) => {
        const balance = await this.getBalance(account.id);
        return {
          ...account,
          balance,
        };
      }),
    );
    return balances;
  }
}

