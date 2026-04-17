import { Injectable, Logger } from '@nestjs/common';
import { CreateReservationDto, ReservationResponseDto } from '../dto';
import { ReservationRepository } from '../repository';
import {
  AccountRepository,
  TransferRepository,
  JournalRepository,
  EntryRepository,
} from '../../transfers/repository';
import { EntryBuilderService } from '../../transfers/services';
import { TransferValidator } from '../../transfers/validators';
import { PrismaTransactionClient } from '../../../common/types';
import { PrismaService } from '../../../common/database/prisma.service';

/**
 * Reservation Executor Service
 *
 * Single Responsibility: Executes reservation within transaction
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class ReservationExecutorService {
  private readonly logger = new Logger(ReservationExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationRepository: ReservationRepository,
    private readonly accountRepository: AccountRepository,
    private readonly transferRepository: TransferRepository,
    private readonly journalRepository: JournalRepository,
    private readonly entryRepository: EntryRepository,
    private readonly entryBuilder: EntryBuilderService,
    private readonly validator: TransferValidator,
  ) {}

  /**
   * Execute reservation within transaction
   * Moves funds from spendable to reserved account
   */
  async execute(
    createReservationDto: CreateReservationDto,
    tx: PrismaTransactionClient,
  ): Promise<ReservationResponseDto> {
    const asset = createReservationDto.asset || 'USDT';
    const chain = createReservationDto.chain || 'eth';

    // Get or create spendable account
    const spendableAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: createReservationDto.userId,
        asset,
        chain,
        purpose: 'spendable',
      },
      tx,
    );

    // Get or create reserved account
    const reservedAccount = await this.accountRepository.findOrCreate(
      {
        ownerType: 'user',
        ownerId: createReservationDto.userId,
        asset,
        chain,
        purpose: 'reserved',
      },
      tx,
    );

    // Check balance
    const balance = await this.accountRepository.getBalance(spendableAccount.id, tx);
    this.validator.validateBalance(balance, createReservationDto.amount);

    // Create reservation record
    const reservation = await this.reservationRepository.create(
      {
        userId: createReservationDto.userId,
        amount: createReservationDto.amount,
        asset,
        chain,
        reference: createReservationDto.reference,
        idempotencyKey: createReservationDto.idempotencyKey,
      },
      tx,
    );

    // Create internal transfer to move funds: spendable → reserved
    const transfer = await this.transferRepository.create(
      {
        type: 'internal',
        asset,
        amount: createReservationDto.amount,
        chain,
        senderId: createReservationDto.userId,
        destinationUserId: createReservationDto.userId, // Self-transfer
        destinationChain: chain,
        status: 'pending',
        idempotencyKey: `reservation-${reservation.id}`,
      },
      tx,
    );

    // Update status to 'process' when processing starts
    await this.transferRepository.updateStatus(transfer.id, 'process', null, tx);

    // Create journal
    const journal = await this.journalRepository.create(
      {
        type: 'internal_transfer',
        asset,
        chain,
        userId: createReservationDto.userId,
        transferId: transfer.id,
        idempotencyKey: `reservation-journal-${reservation.id}`,
      },
      tx,
    );

    // Create entries: debit spendable, credit reserved
    const entries = [
      {
        journalId: journal.id,
        accountId: spendableAccount.id,
        amount: -createReservationDto.amount, // Debit spendable
      },
      {
        journalId: journal.id,
        accountId: reservedAccount.id,
        amount: createReservationDto.amount, // Credit reserved
      },
    ];

    // Validate double-entry
    this.validator.validateDoubleEntry(entries);

    // Create entries
    await this.entryRepository.createMany(entries, tx);

    // Update status to 'completed' after successful processing
    await this.transferRepository.updateStatus(transfer.id, 'completed', null, tx);

    // Update reservation with transfer ID
    await this.reservationRepository.updateStatus(
      reservation.id,
      'reserved',
      transfer.id,
      tx,
    );

    this.logger.log(`Reservation created: ${reservation.id}`);

    return this.mapToReservationResponse(reservation, 'reserved');
  }

  /**
   * Map reservation to response DTO
   */
  private mapToReservationResponse(
    reservation: any,
    status: string,
  ): ReservationResponseDto {
    return {
      id: reservation.id,
      userId: reservation.userId,
      amount: parseFloat(reservation.amount.toString()),
      reference: reservation.reference,
      status,
      idempotencyKey: reservation.idempotencyKey || undefined,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  }
}

