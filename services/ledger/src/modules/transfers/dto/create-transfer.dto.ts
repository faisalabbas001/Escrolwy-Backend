import {
  IsUUID,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { JournalType } from '../../../common/types';

export enum TransferType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  ESCROW_RELEASED = 'escrow_released',
}

export enum TransferAsset {
  USDT = 'USDT',
  USDC = 'USDC',
  ETH = 'ETH',
  BNB = 'BNB',
}

export enum TransferChain {
  ETH = 'eth',
  BNB = 'bnb',
  POLY = 'poly',
  SOL = 'sol',
  TRC = 'trc',
}

/**
 * Create Transfer DTO
 *
 * Request body for creating a new transfer
 * Note: senderId is automatically set from the authenticated user
 */
export class CreateTransferDto {
  @IsEnum(TransferType, {
    message: 'Type must be internal, external, or escrow_released',
  })
  type: TransferType;

  @IsEnum(TransferAsset, {
    message: 'Asset must be USDT, USDC, ETH, or BNB',
  })
  asset: TransferAsset;

  @IsNumber()
  @Min(0.000001, { message: 'Amount must be greater than 0' })
  amount: number;

  @IsEnum(TransferChain, {
    message: 'Chain must be eth, bnb, poly, sol, or trc',
  })
  chain: TransferChain;

  @IsOptional()
  @IsUUID()
  destinationUserId?: string; // Optional for platform-directed internal transfers

  @IsOptional()
  @IsString()
  @MaxLength(255)
  destinationAddress?: string; // Required for external transfers

  /**
   * Optional destination purpose for platform-directed transfers.
   * Used to credit specific platform accounts (fees, escrow holding).
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  destinationPurpose?: 'fees' | 'escrow_holding' | 'treasury_hot';

  @IsOptional()
  @IsEnum(TransferChain, {
    message: 'Destination chain must be eth, bnb, poly, sol, or trc',
  })
  destinationChain?: TransferChain;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  idempotencyKey?: string; // Prevent duplicate transfers

  /**
   * Optional journal type to explicitly specify the business reason for the transfer.
   * If not provided, will be derived from transfer type (backward compatibility).
   * Used for granular tracking of escrow and wallet lifecycle events.
   */
  @IsOptional()
  @IsEnum(JournalType, {
    message: 'Journal type must be a valid JournalType enum value',
  })
  journalType?: JournalType;
}

/**
 * Transfer Response DTO
 *
 * Response body for transfer operations
 */
export class TransferResponseDto {
  id: string;
  type: string;
  asset: string;
  amount: number;
  chain: string;
  senderId: string;
  destinationUserId?: string;
  destinationAddress?: string;
  destinationChain: string;
  status: string;
  failureReason?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

