import { PrismaTransactionClient } from '../../../../common/types';

export interface IOutboxRepository {
  create(
    data: {
      eventType: string;
      eventKey: string;
      payload: any;
      status?: string;
    },
    tx?: PrismaTransactionClient,
  ): Promise<any>;
}

