import { PrismaTransactionClient } from '../../../../common/types';

export interface IJournalRepository {
  create(
    data: {
      type: string;
      asset: string;
      chain: string;
      userId: string;
      transferId: string;
      idempotencyKey?: string | null;
    },
    tx?: PrismaTransactionClient,
  ): Promise<any>;
}

