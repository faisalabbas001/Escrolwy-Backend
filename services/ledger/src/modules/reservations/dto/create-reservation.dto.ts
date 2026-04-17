import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Create Reservation DTO
 *
 * Request body for creating a new reservation
 * Reserves amount from user's spendable account to reserved account
 */
export class CreateReservationDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0.000001, { message: 'Amount must be greater than 0' })
  amount: number;

  @IsString()
  @MaxLength(255)
  reference: string; // e.g., escrow_id

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  idempotencyKey?: string; // Prevent duplicate reservations

  @IsOptional()
  @IsString()
  @MaxLength(50)
  asset?: string; // Default: USDT

  @IsOptional()
  @IsString()
  @MaxLength(50)
  chain?: string; // Default: eth
}

/**
 * Reservation Response DTO
 */
export class ReservationResponseDto {
  id: string;
  userId: string;
  amount: number;
  reference: string;
  status: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

