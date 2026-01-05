import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateReservationDto } from '../dto';
import { ReservationRepository } from '../repository';

/**
 * Reservation Validator
 *
 * Single Responsibility: Validates reservation requests
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class ReservationValidator {
  constructor(private readonly reservationRepository: ReservationRepository) {}

  /**
   * Validate reservation request requirements
   */
  validateRequest(createReservationDto: CreateReservationDto): void {
    if (createReservationDto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }
  }

  /**
   * Check if reservation with idempotency key already exists
   */
  async checkIdempotency(idempotencyKey?: string): Promise<void> {
    if (!idempotencyKey) return;

    const existing = await this.reservationRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      throw new ConflictException(
        `Reservation with idempotency key ${idempotencyKey} already exists`,
      );
    }
  }

  /**
   * Validate balance sufficiency
   */
  validateBalance(balance: number, requiredAmount: number): void {
    if (balance < requiredAmount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balance}, Required: ${requiredAmount}`,
      );
    }
  }
}

