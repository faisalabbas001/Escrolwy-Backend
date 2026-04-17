import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateExternalTransferDto, ExternalTransferResponseDto } from './dto/external-transfer.dto';
import { TransferService } from '../transfers/transfer.service';
import { CreateTransferDto, TransferType } from '../transfers/dto/create-transfer.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * External Transfer Service
 *
 * Single Responsibility: Orchestrates external transfer operations (user to external blockchain)
 * Follows Single Responsibility Principle (SRP)
 * 
 * Uses the main TransferService with type='external' for consistency
 */
@Injectable()
export class ExternalTransferService {
  private readonly logger = new Logger(ExternalTransferService.name);

  constructor(
    private readonly transferService: TransferService,
  ) {}

  /**
   * Create external transfer
   * Transfers funds from user to external blockchain address
   * Uses the main TransferService with type='external' - no separate tracking table needed
   * Kafka event will be produced by TransferService
   */
  async createExternalTransfer(
    createDto: CreateExternalTransferDto,
    userId: string,
  ): Promise<ExternalTransferResponseDto> {
    // Convert to main TransferDto format
    const transferDto: CreateTransferDto = {
      type: TransferType.EXTERNAL,
      asset: (createDto.asset || 'USDT') as any,
      amount: createDto.amount,
      chain: (createDto.chain || 'eth') as any,
      destinationAddress: createDto.destinationAddress,
      destinationChain: (createDto.chain || 'eth') as any,
      idempotencyKey: `external-transfer-${userId}-${createDto.destinationAddress}-${createDto.asset}-${createDto.amount}-${createDto.chain}-${uuidv4()}`,
    };

    // Create transfer via main TransferService (handles double-entry accounting)
    const transfer = await this.transferService.createTransfer(transferDto, userId);

    this.logger.log(
      `External transfer created: ${transfer.id} for user ${userId} to ${createDto.destinationAddress}`,
    );

    // Map Transfer to ExternalTransferResponseDto
    return {
      id: transfer.id,
      userId: userId,
      amount: transfer.amount,
      destination: createDto.destination,
      destinationAddress: createDto.destinationAddress,
      reference: createDto.reference,
      status: transfer.status.toUpperCase(),
      idempotencyKey: transfer.idempotencyKey,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }

  /**
   * Get external transfer by ID
   */
  async getExternalTransfer(id: string): Promise<ExternalTransferResponseDto> {
    const transfer = await this.transferService.getTransfer(id);

    // Verify it's an external transfer
    if (transfer.type !== 'external') {
      throw new NotFoundException(`Transfer ${id} is not an external transfer`);
    }

    // Map Transfer to ExternalTransferResponseDto
    // Note: destination and reference are not stored in Transfer table
    // They would need to be stored elsewhere or passed differently if needed
    return {
      id: transfer.id,
      userId: transfer.senderId,
      amount: transfer.amount,
      destination: 'blockchain', // Default since not stored in Transfer table
      destinationAddress: transfer.destinationAddress,
      reference: '', // Not stored in Transfer table
      status: transfer.status.toUpperCase(),
      idempotencyKey: transfer.idempotencyKey,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }
}

