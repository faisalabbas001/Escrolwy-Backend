import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { TransferRepository } from '../repository';

/**
 * Transfer Validator
 *
 * Single Responsibility: Validates transfer requests
 * Follows Single Responsibility Principle (SRP)
 *
 * Note: While we inject concrete classes (required by NestJS DI), they implement interfaces
 * which provides type safety and allows for easy substitution in tests or future implementations.
 */
@Injectable()
export class TransferValidator {
  constructor(private readonly transferRepository: TransferRepository) {}

  /**
   * Validate transfer request requirements
   */
  validateRequest(createTransferDto: CreateTransferDto): void {
    if (createTransferDto.type === 'internal') {
      const platformDirected =
        createTransferDto.destinationPurpose === 'fees' ||
        createTransferDto.destinationPurpose === 'escrow_holding' ||
        createTransferDto.destinationPurpose === 'treasury_hot';

      if (!platformDirected && !createTransferDto.destinationUserId) {
        throw new BadRequestException(
          'destinationUserId is required for internal transfers (unless destinationPurpose targets platform)',
        );
      }
    }

    if (createTransferDto.type === 'escrow_released' && !createTransferDto.destinationUserId) {
      throw new BadRequestException(
        'destinationUserId is required for escrow_released transfers',
      );
    }

    if (createTransferDto.type === 'external' && !createTransferDto.destinationAddress) {
      throw new BadRequestException(
        'destinationAddress is required for external transfers',
      );
    }
  }

  /**
   * Check if transfer with idempotency key already exists
   */
  async checkIdempotency(idempotencyKey?: string): Promise<void> {
    if (!idempotencyKey) return;

    const existing = await this.transferRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      throw new ConflictException(
        `Transfer with idempotency key ${idempotencyKey} already exists`,
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

  /**
   * Validate double-entry accounting (sum must be zero)
   */
  validateDoubleEntry(
    entries: Array<{ journalId: string; accountId: string; amount: number }>,
  ): void {
    const sum = entries.reduce((acc, e) => acc + e.amount, 0);
    if (Math.abs(sum) > 0.000001) {
      throw new Error(`Double-entry validation failed: sum = ${sum}`);
    }
  }
}

