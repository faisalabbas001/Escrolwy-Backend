import { ApiProperty } from '@nestjs/swagger';

export class CreateTransferDtoDocs {
  @ApiProperty({
    description: 'Transfer type',
    example: 'internal',
    enum: ['internal', 'external'],
  })
  type: string;

  @ApiProperty({
    description: 'Asset type',
    example: 'USDT',
    enum: ['USDT', 'USDC', 'ETH', 'BNB'],
  })
  asset: string;

  @ApiProperty({
    description: 'Transfer amount',
    example: 100.5,
    type: Number,
    minimum: 0.000001,
  })
  amount: number;

  @ApiProperty({
    description: 'Source blockchain chain',
    example: 'eth',
    enum: ['eth', 'bnb', 'poly', 'sol', 'trc'],
  })
  chain: string;

  @ApiProperty({
    description: 'Destination user ID (required for internal transfers)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    type: String,
    required: false,
  })
  destinationUserId?: string;

  @ApiProperty({
    description: 'Destination wallet address (required for external transfers)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    type: String,
    required: false,
  })
  destinationAddress?: string;

  @ApiProperty({
    description: 'Destination blockchain chain',
    example: 'eth',
    enum: ['eth', 'bnb', 'poly', 'sol', 'trc'],
  })
  destinationChain: string;

  @ApiProperty({
    description: 'Idempotency key to prevent duplicate transfers',
    example: 'unique-key-12345',
    type: String,
    required: false,
  })
  idempotencyKey?: string;
}

export class TransferResponseDtoDocs {
  @ApiProperty({
    description: 'Transfer ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Transfer type',
    example: 'internal',
    enum: ['internal', 'external'],
  })
  type: string;

  @ApiProperty({
    description: 'Asset type',
    example: 'USDT',
    enum: ['USDT', 'USDC', 'ETH', 'BNB'],
  })
  asset: string;

  @ApiProperty({
    description: 'Transfer amount',
    example: 100.5,
    type: Number,
  })
  amount: number;

  @ApiProperty({
    description: 'Source blockchain chain',
    example: 'eth',
    enum: ['eth', 'bnb', 'poly', 'sol', 'trc'],
  })
  chain: string;

  @ApiProperty({
    description: 'Sender user ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    type: String,
  })
  senderId: string;

  @ApiProperty({
    description: 'Destination user ID (for internal transfers)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    type: String,
    required: false,
  })
  destinationUserId?: string;

  @ApiProperty({
    description: 'Destination wallet address (for external transfers)',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    type: String,
    required: false,
  })
  destinationAddress?: string;

  @ApiProperty({
    description: 'Destination blockchain chain',
    example: 'eth',
    enum: ['eth', 'bnb', 'poly', 'sol', 'trc'],
  })
  destinationChain: string;

  @ApiProperty({
    description: 'Transfer status',
    example: 'completed',
    enum: ['pending', 'process', 'failed', 'completed'],
  })
  status: string;

  @ApiProperty({
    description: 'Failure reason (if status is failed)',
    example: 'Insufficient balance',
    type: String,
    required: false,
  })
  failureReason?: string;

  @ApiProperty({
    description: 'Idempotency key',
    example: 'unique-key-12345',
    type: String,
    required: false,
  })
  idempotencyKey?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-12-11T10:30:00Z',
    type: String,
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-12-11T11:00:00Z',
    type: String,
  })
  updatedAt: string;
}

