import { PrismaTransactionClient } from '../../../../common/types';

export interface IAccountRepository {
  findOrCreate(
    params: {
      ownerType: string;
      ownerId: string | null;
      asset: string;
      chain: string;
      purpose: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<any>;

  getBalance(
    accountId: string,
    tx?: PrismaTransactionClient,
  ): Promise<number>;

  findById(id: string): Promise<any>;

  getUserBalances(userId: string): Promise<Array<{
    id: string;
    ownerType: string;
    ownerId: string | null;
    asset: string;
    chain: string;
    purpose: string;
    balance: number;
    createdAt: Date;
    updatedAt: Date;
  }>>;
}

