import { PrismaTransactionClient } from '../../../../common/types';

export interface ITransferRepository {
  create(
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
  ): Promise<any>;

  findById(id: string): Promise<any>;

  findByIdempotencyKey(idempotencyKey: string): Promise<any>;

  updateStatus(
    id: string,
    status: string,
    failureReason?: string | null,
    tx?: PrismaTransactionClient,
  ): Promise<any>;
}

