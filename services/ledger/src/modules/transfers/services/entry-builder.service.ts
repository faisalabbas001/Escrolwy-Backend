import { Injectable } from '@nestjs/common';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { AccountResolverService } from './account-resolver.service';
import { TransferValidator } from '../validators/transfer.validator';
import { PrismaTransactionClient } from '../../../common/types';

/**
 * Entry Builder Service
 *
 * Single Responsibility: Builds double-entry accounting entries
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class EntryBuilderService {
  constructor(
    private readonly accountResolver: AccountResolverService,
    private readonly validator: TransferValidator,
  ) {}

  /**
   * Build double-entry accounting entries
   */
  async buildEntries(
    createTransferDto: CreateTransferDto,
    journalId: string,
    senderAccountId: string,
    tx?: PrismaTransactionClient,
  ): Promise<Array<{ journalId: string; accountId: string; amount: number }>> {
    const entries: Array<{ journalId: string; accountId: string; amount: number }> = [];

    // Debit sender's account
    entries.push({
      journalId,
      accountId: senderAccountId,
      amount: -createTransferDto.amount,
    });

    // Credit destination account
    const creditAccount = await this.accountResolver.getCreditAccount(createTransferDto, tx);
    entries.push({
      journalId,
      accountId: creditAccount.id,
      amount: createTransferDto.amount,
    });

    // Validate double-entry
    this.validator.validateDoubleEntry(entries);

    return entries;
  }
}

