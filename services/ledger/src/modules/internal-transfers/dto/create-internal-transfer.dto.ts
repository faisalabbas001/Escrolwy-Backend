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
import { TransferAsset, TransferChain } from '../../transfers/dto/create-transfer.dto';

/**
 * Create Internal Transfer DTO
 *
 * Request body for creating an internal transfer (user-to-user within Escrowly)
 * Transfers funds from authenticated user to another registered user
 */
export class CreateInternalTransferDto {
  @IsUUID()
  destinationUserId: string; // User ID of the recipient (must be registered on Escrowly)

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
  @IsEnum(TransferChain, {
    message: 'Destination chain must be eth, bnb, poly, sol, or trc',
  })
  destinationChain?: TransferChain; // Defaults to same as source chain

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  idempotencyKey?: string; // Prevent duplicate transfers
}

/**
 * Internal Transfer Response DTO
 */
export class InternalTransferResponseDto {
  id: string;
  senderId: string;
  destinationUserId: string;
  asset: string;
  amount: number;
  chain: string;
  destinationChain: string;
  status: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

