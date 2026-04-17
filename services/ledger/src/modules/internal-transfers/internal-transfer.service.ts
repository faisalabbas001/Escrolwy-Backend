import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateInternalTransferDto, InternalTransferResponseDto } from './dto';
import { TransferService } from '../transfers/transfer.service';
import { CreateTransferDto, TransferType } from '../transfers/dto/create-transfer.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Internal Transfer Service
 *
 * Single Responsibility: Orchestrates internal transfer operations (user-to-user)
 * Follows Single Responsibility Principle (SRP)
 * 
 * Uses the main TransferService with type='internal' for consistency
 */
@Injectable()
export class InternalTransferService {
  private readonly logger = new Logger(InternalTransferService.name);

  constructor(
    private readonly transferService: TransferService,
  ) {}

  /**
   * Create a new internal transfer (user-to-user)
   * Transfers funds from sender to recipient within Escrowly platform
   */
  async createInternalTransfer(
    createDto: CreateInternalTransferDto,
    senderId: string,
  ): Promise<InternalTransferResponseDto> {
    // Convert to main TransferDto format
    const transferDto: CreateTransferDto = {
      type: TransferType.INTERNAL,
      asset: createDto.asset,
      amount: createDto.amount,
      chain: createDto.chain,
      destinationUserId: createDto.destinationUserId,
      destinationChain: createDto.destinationChain || createDto.chain,
      idempotencyKey: `internal-transfer-${senderId}-${createDto.destinationUserId }-${createDto.asset}-${createDto.amount}-${createDto.chain}-${uuidv4()}`,
    };

    const transfer = await this.transferService.createTransfer(transferDto, senderId);

    // Map to InternalTransferResponseDto
    return {
      id: transfer.id,
      senderId: transfer.senderId,
      destinationUserId: transfer.destinationUserId!,
      asset: transfer.asset,
      amount: transfer.amount,
      chain: transfer.chain,
      destinationChain: transfer.destinationChain,
      status: transfer.status,
      idempotencyKey: transfer.idempotencyKey,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }

  /**
   * Get internal transfer by ID
   */
  async getInternalTransfer(id: string): Promise<InternalTransferResponseDto> {
    const transfer = await this.transferService.getTransfer(id);

    // Verify it's an internal transfer
    if (transfer.type !== 'internal') {
      throw new NotFoundException(`Transfer ${id} is not an internal transfer`);
    }

    // Map to InternalTransferResponseDto
    return {
      id: transfer.id,
      senderId: transfer.senderId,
      destinationUserId: transfer.destinationUserId!,
      asset: transfer.asset,
      amount: transfer.amount,
      chain: transfer.chain,
      destinationChain: transfer.destinationChain,
      status: transfer.status,
      idempotencyKey: transfer.idempotencyKey,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    };
  }
}

