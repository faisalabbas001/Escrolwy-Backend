import {
  IsUUID,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
  IsISO8601,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum EscrowAsset {
  USDT = 'USDT',
  USDC = 'USDC',
  ETH = 'ETH',
  BNB = 'BNB',
}

export enum EscrowChain {
  ETH = 'eth',
  BNB = 'bnb',
  POLY = 'poly',
  SOL = 'sol',
  TRC = 'trc',
}

/**
 * Create Escrow DTO
 *
 * Request body for creating a new escrow
 * Note: createdBy is automatically set from the authenticated user
 */
export class CreateEscrowDto {
  @IsUUID()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  buyerId: string;

  @IsUUID()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  sellerId: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  brokerId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(EscrowAsset, { message: 'Asset must be USDT, USDC, ETH, or BNB' })
  asset: EscrowAsset;

  @IsEnum(EscrowChain, { message: 'Chain must be eth, bnb, poly, sol, or trc' })
  chain: EscrowChain;


  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  platformFeeTotal?: number; // Override calculated fee

  @IsOptional()
  @IsEnum(['buyer', 'seller', 'split', 'broker'], {
    message: 'feePaidBy must be buyer, seller, split, or broker',
  })
  feePaidBy?: 'buyer' | 'seller' | 'split' | 'broker';

  @IsOptional()
  feeSplitPercentages?: {
    buyer?: number; // 0-100
    seller?: number; // 0-100
    broker?: number; // 0-100 (optional)
  };
}

/**
 * Update Escrow DTO
 *
 * Request body for updating escrow details
 */
export class UpdateEscrowDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
}

/**
 * Accept Escrow DTO
 *
 * Request body for accepting an escrow agreement
 */
export class AcceptEscrowDto {
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  reason?: string;
}

/**
 * Cancel Escrow DTO
 *
 * Request body for canceling an escrow
 */
export class CancelEscrowDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  reason: string;
}
