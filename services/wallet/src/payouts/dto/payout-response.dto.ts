import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payout Response DTO
 */
export class PayoutResponseDto {
  @ApiProperty({
    description: 'Unique payout request ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who requested the payout',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @ApiProperty({
    description: 'Blockchain chain identifier',
    example: 'evm',
    enum: ['evm', 'sol', 'trc'],
  })
  chain: string;

  @ApiProperty({
    description: 'Token/asset symbol',
    example: 'USDT',
  })
  asset: string;

  @ApiProperty({
    description: 'Payout amount',
    example: '100.50',
  })
  amount: string;

  @ApiProperty({
    description: 'Destination wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  destinationAddress: string;

  @ApiProperty({
    description: 'Current payout status',
    example: 'fulfilled',
    enum: ['pending', 'fulfilled', 'failed'],
  })
  status: string;

  @ApiPropertyOptional({
    description: 'On-chain transaction hash (if completed)',
    example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  })
  txHash?: string;

  @ApiPropertyOptional({
    description: 'Block number (if completed)',
    example: 18500000,
  })
  blockNumber?: number;

  @ApiPropertyOptional({
    description: 'Gas used for the transaction',
    example: '21000',
  })
  gasUsed?: string;

  @ApiProperty({
    description: 'Payout request creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:35:00.000Z',
  })
  updatedAt: string;
}

/**
 * Paginated Payouts Response DTO
 */
export class PaginatedPayoutsResponseDto {
  @ApiProperty({
    description: 'List of payouts',
    type: [PayoutResponseDto],
  })
  data: PayoutResponseDto[];

  @ApiProperty({
    description: 'Total number of payouts',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;
}

