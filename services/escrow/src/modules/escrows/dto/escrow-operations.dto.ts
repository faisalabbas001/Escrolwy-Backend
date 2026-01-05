import { IsNumber, Min, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum FeePayerType {
  BUYER = 'buyer',
  SELLER = 'seller',
  SPLIT = 'split',
}

/**
 * Process Payment DTO
 *
 * Request body for processing escrow payment
 */
export class ProcessPaymentDto {
  @IsNumber()
  @Min(0.000001)
  amount: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  metadata?: string;
}

/**
 * Record Delivery DTO
 *
 * Request body for recording delivery
 */
export class RecordDeliveryDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  deliveryProof: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  notes?: string;
}

/**
 * Record Inspection DTO
 *
 * Request body for recording inspection
 */
export class RecordInspectionDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  inspectionNotes: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  metadata?: string;
}

/**
 * File Dispute DTO
 *
 * Request body for filing a dispute
 */
export class FileDisputeDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  reason: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  evidence?: string;
}

/**
 * Resolve Dispute DTO
 *
 * Request body for resolving a dispute (admin only)
 */
export class ResolveDisputeDto {
  @IsEnum(['buyer_wins', 'seller_wins', 'refund'], {
    message: 'Resolution must be buyer_wins, seller_wins, or refund',
  })
  resolution: 'buyer_wins' | 'seller_wins' | 'refund';

  @IsString()
  @Transform(({ value }) => value?.trim())
  adminNotes: string;
}

/**
 * Admin Force Close DTO
 *
 * Request body for admin force closing an escrow
 */
export class AdminForceCloseDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  reason: string;

  @IsOptional()
  @IsEnum(['refund_buyer', 'release_seller', 'no_action'], {
    message: 'Action must be refund_buyer, release_seller, or no_action',
  })
  fundsAction?: 'refund_buyer' | 'release_seller' | 'no_action';
}