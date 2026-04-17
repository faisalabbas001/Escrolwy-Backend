import { PrismaTransactionClient } from '../../../../common/types';

export interface IEntryRepository {
  createMany(
    entries: Array<{ journalId: string; accountId: string; amount: number }>,
    tx?: PrismaTransactionClient,
  ): Promise<any>;
}

