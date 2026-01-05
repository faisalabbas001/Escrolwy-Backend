import { Injectable, Logger } from '@nestjs/common';
import { CreateReservationDto, ReservationResponseDto } from './dto';
import { ReservationRepository } from './repository';
import { ReservationValidator } from './validators';
import { ReservationExecutorService } from './services';
import { PrismaService } from '../../common/database/prisma.service';

/**
 * Reservation Service
 *
 * Single Responsibility: Orchestrates reservation operations
 * Follows Single Responsibility Principle (SRP)
 * Orchestrates validation and execution, doesn't implement business logic
 */
@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: ReservationValidator,
    private readonly executor: ReservationExecutorService,
    private readonly reservationRepository: ReservationRepository,
  ) {}

  /**
   * Create a new reservation
   * Main entry point for reserving funds
   */
  async createReservation(
    createReservationDto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    this.validator.validateRequest(createReservationDto);
    await this.validator.checkIdempotency(createReservationDto.idempotencyKey);

    return this.prisma.$transaction(async (tx) => {
      return this.executor.execute(createReservationDto, tx);
    });
  }

  /**
   * Get reservation by ID
   */
  async getReservation(id: string): Promise<ReservationResponseDto> {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new Error(`Reservation ${id} not found`);
    }

    return {
      id: reservation.id,
      userId: reservation.userId,
      amount: parseFloat(reservation.amount.toString()),
      reference: reservation.reference,
      status: reservation.status,
      idempotencyKey: reservation.idempotencyKey || undefined,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  }

  /**
   * Release reservation (move from reserved to escrow holding pool)
   */
  async releaseReservation(
    id: string,
    escrowHoldingPoolAccountId: string,
  ): Promise<ReservationResponseDto> {
    // Implementation will use internal transfer
    // For now, just update status
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new Error(`Reservation ${id} not found`);
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`Reservation ${id} is not in reserved status`);
    }

    // TODO: Create internal transfer: reserved → escrow_holding_pool
    // For now, just mark as released
    const updated = await this.reservationRepository.updateStatus(id, 'released');
    return {
      id: updated.id,
      userId: updated.userId,
      amount: parseFloat(updated.amount.toString()),
      reference: updated.reference,
      status: updated.status,
      idempotencyKey: updated.idempotencyKey || undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Cancel reservation (move back from reserved to spendable)
   */
  async cancelReservation(id: string): Promise<ReservationResponseDto> {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new Error(`Reservation ${id} not found`);
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`Reservation ${id} cannot be cancelled`);
    }

    // TODO: Create internal transfer: reserved → spendable
    // For now, just mark as cancelled
    const updated = await this.reservationRepository.updateStatus(id, 'cancelled');
    return {
      id: updated.id,
      userId: updated.userId,
      amount: parseFloat(updated.amount.toString()),
      reference: updated.reference,
      status: updated.status,
      idempotencyKey: updated.idempotencyKey || undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}

