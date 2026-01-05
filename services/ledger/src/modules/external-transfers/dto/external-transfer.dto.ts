import {
  IsUUID,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Create External Transfer DTO
 */
export class CreateExternalTransferDto {
  @IsNumber()
  @Min(0.000001)
  amount: number;

  @IsString()
  @MaxLength(50)
  destination: string; // BANK, blockchain, etc.

  @IsString()
  @MaxLength(255)
  destinationAddress: string; // Required: Blockchain address or bank account

  @IsString()
  @MaxLength(255)
  reference: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  idempotencyKey?: string;

  @IsString()
  @MaxLength(50)
  asset?: string; // Default: USDT

  @IsString()
  @MaxLength(50)
  chain?: string; // Default: eth
}

/**
 * External Transfer Response DTO
 */
export class ExternalTransferResponseDto {
  id: string;
  userId: string;
  amount: number;
  destination: string;
  destinationAddress?: string;
  reference: string;
  status: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

