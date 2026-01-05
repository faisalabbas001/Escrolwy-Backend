import { Injectable, Logger } from '@nestjs/common';
import { CreateTransferDto, TransferResponseDto } from '../dto/create-transfer.dto';
import {
  AccountRepository,
  TransferRepository,
  JournalRepository,
  EntryRepository,
} from '../repository';
import { AccountResolverService } from './account-resolver.service';
import { EntryBuilderService } from './entry-builder.service';
import { TransferEventService } from './transfer-event.service';
import { TransferValidator } from '../validators/transfer.validator';
import { PrismaTransactionClient, JournalType } from '../../../common/types';

/**
 * Transfer Executor Service
 *
 * Single Responsibility: Executes transfer within transaction
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - depends on concrete classes that implement interfaces
 *
 * Note: While we inject concrete classes (required by NestJS DI), they implement interfaces
 * which provides type safety and allows for easy substitution in tests or future implementations.
 */
@Injectable()
export class TransferExecutorService {
  private readonly logger = new Logger(TransferExecutorService.name);

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transferRepository: TransferRepository,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly accountResolver: AccountResolverService,
    private readonly entryBuilder: EntryBuilderService,
    private readonly eventService: TransferEventService,
    private readonly validator: TransferValidator,
  ) {}

  /**
   * Execute transfer within transaction
   */
  async execute(
    createTransferDto: CreateTransferDto,
    senderId: string,
    tx: PrismaTransactionClient,
  ): Promise<TransferResponseDto> {
    const senderAccount = await this.accountResolver.getSenderAccount(
      senderId,
      createTransferDto,
      tx,
    );

    // Skip balance validation for platform-originated transfers (deposits)
    // Platform can always fund users - it's the source of funds
    const isPlatformDeposit = senderId === 'platform' || senderId === null;
    if (!isPlatformDeposit) {
      const balance = await this.accountRepository.getBalance(senderAccount.id, tx);
      this.validator.validateBalance(balance, createTransferDto.amount);
    }

    const transfer = await this.createTransferRecord(createTransferDto, senderId, tx);
    
    // Update status to 'process' when processing starts
    await this.transferRepository.updateStatus(transfer.id, 'process', null, tx);
    
    const journal = await this.createJournal(createTransferDto, senderId, transfer.id, tx);
    const entries = await this.entryBuilder.buildEntries(
      createTransferDto,
      journal.id,
      senderAccount.id,
      tx,
    );

    await this.entryRepository.createMany(entries, tx);
    
    // Get credit account for balance updated events
    const creditAccount = await this.accountResolver.getCreditAccount(createTransferDto, tx);
    
 

    // Update status to 'completed' after successful processing
    await this.transferRepository.updateStatus(transfer.id, 'completed', null, tx);

    this.logger.log(`Transfer created: ${transfer.id}`);

    await this.eventService.createEvents(
      createTransferDto,
      transfer,
      journal.id,
      senderId,
      senderAccount.id,
      creditAccount.id,
      tx,
    );
    
    return this.mapToTransferResponse(transfer, 'completed');
  }

  /**
   * Create transfer record
   */
  private async createTransferRecord(
    createTransferDto: CreateTransferDto,
    senderId: string,
    tx: PrismaTransactionClient,
  ) {
    return this.transferRepository.create(
      {
        type: createTransferDto.type,
        asset: createTransferDto.asset,
        amount: createTransferDto.amount,
        chain: createTransferDto.chain,
        senderId,
        destinationUserId: createTransferDto.destinationUserId,
        destinationAddress: createTransferDto.destinationAddress,
        destinationChain: createTransferDto.destinationChain,
        status: 'pending',
        idempotencyKey: createTransferDto.idempotencyKey,
      },
      tx,
    );
  }

  /**
   * Create journal record
   */
  private async createJournal(
    createTransferDto: CreateTransferDto,
    senderId: string,
    transferId: string,
    tx: PrismaTransactionClient,
  ) {
    // Use explicit journal type if provided, otherwise derive from transfer type (backward compatibility)
    let journalType = createTransferDto.journalType;
    if (!journalType) {
      if (createTransferDto.type === 'internal') {
        journalType = JournalType.INTERNAL_TRANSFER;
      } else if (createTransferDto.type === 'escrow_released') {
        journalType = JournalType.ESCROW_PAY_RELEASED;
      } else {
        journalType = JournalType.EXTERNAL_TRANSFER;
      }
    }

    return this.journalRepository.create(
      {
        type: journalType,
        asset: createTransferDto.asset,
        chain: createTransferDto.chain,
        userId: senderId,
        transferId,
        idempotencyKey: createTransferDto.idempotencyKey,
      },
      tx,
    );
  }

  /**
   * Map transfer entity to response DTO
   */
  private mapToTransferResponse(transfer: any, statusOverride?: string): TransferResponseDto {
    return {
      id: transfer.id,
      type: transfer.type,
      asset: transfer.asset,
      amount: parseFloat(transfer.amount.toString()),
      chain: transfer.chain,
      senderId: transfer.senderId,
      destinationUserId: transfer.destinationUserId || undefined,
      destinationAddress: transfer.destinationAddress || undefined,
      destinationChain: transfer.destinationChain,
      status: statusOverride || transfer.status,
      failureReason: transfer.failureReason || undefined,
      idempotencyKey: transfer.idempotencyKey || undefined,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }
}

