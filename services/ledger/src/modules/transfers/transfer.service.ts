import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { TransferRepository } from './repository';
import { CreateTransferDto, TransferResponseDto } from './dto/create-transfer.dto';
import { PrismaService } from '../../common/database/prisma.service';
import { TransferValidator } from './validators/transfer.validator';
import { TransferExecutorService } from './services/transfer-executor.service';

/**
 * Transfer Service
 *
 * Single Responsibility: Orchestrates transfer creation workflow
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - depends on concrete classes that implement interfaces
 *
 * Note: While we inject concrete classes (required by NestJS DI), they implement interfaces
 * which provides type safety and allows for easy substitution in tests or future implementations.
 *
 * Coordinates:
 * - Validation (via TransferValidator)
 * - Execution (via TransferExecutorService)
 * - Transaction management
 */
@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    private readonly transferRepository: TransferRepository,
    private readonly prisma: PrismaService,
    private readonly validator: TransferValidator,
    private readonly executor: TransferExecutorService,
  ) {}

  /**
   * Create a new transfer
   * Main entry point for money movement
   * Orchestrates validation and execution
   */
  async createTransfer(
    createTransferDto: CreateTransferDto,
    senderId: string,
  ): Promise<TransferResponseDto> {
    this.validator.validateRequest(createTransferDto);
    await this.validator.checkIdempotency(createTransferDto.idempotencyKey);

    return this.prisma.$transaction(async (tx) => {
      return this.executor.execute(createTransferDto, senderId, tx);
    });
  }

  /**
   * Get transfer by ID
   */
  async getTransfer(id: string): Promise<TransferResponseDto> {
    const transfer = await this.transferRepository.findById(id);
    if (!transfer) {
      throw new NotFoundException(`Transfer ${id} not found`);
    }

    return this.mapToTransferResponse(transfer);
  }

  /**
   * Map transfer entity to response DTO
   */
  private mapToTransferResponse(transfer: any): TransferResponseDto {
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
      status: transfer.status,
      failureReason: transfer.failureReason || undefined,
      idempotencyKey: transfer.idempotencyKey || undefined,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }
}

