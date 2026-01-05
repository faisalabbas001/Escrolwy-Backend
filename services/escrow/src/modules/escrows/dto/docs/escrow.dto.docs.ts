import { ApiProperty } from '@nestjs/swagger';

export class EscrowResponseDtoDocs {
  @ApiProperty({
    description: 'Unique escrow identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Buyer user ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    type: String,
  })
  buyerId: string;

  @ApiProperty({
    description: 'Seller user ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
    type: String,
  })
  sellerId: string;

  @ApiProperty({
    description: 'Optional broker user ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
    type: String,
    required: false,
  })
  brokerId?: string;

  @ApiProperty({
    description: 'Escrow amount in asset units',
    example: 1000.5,
    type: Number,
  })
  amount: number;

  @ApiProperty({
    description: 'Asset type',
    example: 'USDT',
    enum: ['USDT', 'USDC', 'ETH', 'BNB'],
  })
  asset: string;

  @ApiProperty({
    description: 'Blockchain chain',
    example: 'eth',
    enum: ['eth', 'bnb', 'poly', 'sol', 'trc'],
  })
  chain: string;

  @ApiProperty({
    description: 'Current escrow state',
    example: 'funded',
    enum: ['agreement', 'funded', 'delivery', 'inspection', 'closed', 'disputed'],
  })
  state: string;

  @ApiProperty({
    description: 'Escrow description',
    example: 'Purchase of vintage watch',
    type: String,
    required: false,
  })
  description?: string;

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

  @ApiProperty({
    description: 'SLA expiration timestamp',
    example: '2025-12-18T10:30:00Z',
    type: String,
    required: false,
  })
  expiresAt?: string;

  @ApiProperty({
    description: 'Completion timestamp',
    example: '2025-12-15T14:00:00Z',
    type: String,
    required: false,
  })
  completedAt?: string;

  @ApiProperty({
    description: 'Dispute filing timestamp',
    example: '2025-12-12T10:30:00Z',
    type: String,
    required: false,
  })
  disputedAt?: string;

  @ApiProperty({
    description: 'User/Admin ID who created the escrow',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  createdBy: string;

  @ApiProperty({
    description: 'User ID who filed the dispute',
    example: '550e8400-e29b-41d4-a716-446655440001',
    type: String,
    required: false,
  })
  disputedBy?: string;
}

export class EscrowTransitionDtoDocs {
  @ApiProperty({
    description: 'Transition record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Escrow ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  escrowId: string;

  @ApiProperty({
    description: 'Previous state',
    example: 'agreement',
    type: String,
  })
  previousState: string;

  @ApiProperty({
    description: 'New state',
    example: 'funded',
    type: String,
  })
  newState: string;

  @ApiProperty({
    description: 'User/Admin ID who made the change',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  changedBy: string;

  @ApiProperty({
    description: 'Reason for the transition',
    example: 'Buyer approved payment',
    type: String,
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Additional metadata',
    example: { txHash: '0x123...' },
    type: Object,
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Transition timestamp',
    example: '2025-12-11T10:30:00Z',
    type: String,
  })
  createdAt: string;
}
