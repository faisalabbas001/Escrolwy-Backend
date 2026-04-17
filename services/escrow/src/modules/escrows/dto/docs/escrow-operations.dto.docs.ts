import { ApiProperty } from '@nestjs/swagger';

export class CreateEscrowDtoDocs {
  @ApiProperty({
    description: 'Buyer user ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    type: String,
  })
  buyerId: string;

  @ApiProperty({
    description: 'Seller user ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    type: String,
  })
  sellerId: string;

  @ApiProperty({
    description: 'Optional broker user ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440003',
    type: String,
    required: false,
  })
  brokerId?: string;

  @ApiProperty({
    description: 'Amount of asset to escrow',
    example: 1000.5,
    type: Number,
    minimum: 0,
  })
  amount: number;

  @ApiProperty({
    description: 'Cryptocurrency asset type',
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
    description: 'Optional description of the escrow',
    example: 'Purchase of vintage watch',
    type: String,
    maxLength: 500,
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Optional ISO 8601 expiration timestamp',
    example: '2025-12-18T10:30:00Z',
    type: String,
    required: false,
  })
  expiresAt?: string;
}

export class ProcessPaymentDtoDocs {
  @ApiProperty({
    description: 'Payment amount',
    example: 1000.5,
    type: Number,
    minimum: 0.000001,
  })
  amount: number;

  @ApiProperty({
    description: 'Optional blockchain transaction hash',
    example: '0x1234567890abcdef...',
    type: String,
    required: false,
  })
  transactionHash?: string;

  @ApiProperty({
    description: 'Optional metadata as JSON string',
    example: '{"source": "metamask"}',
    type: String,
    required: false,
  })
  metadata?: string;
}

export class RecordDeliveryDtoDocs {
  @ApiProperty({
    description: 'Delivery proof (tracking number or link)',
    example: 'FEDEX123456789',
    type: String,
  })
  deliveryProof: string;

  @ApiProperty({
    description: 'Optional delivery notes',
    example: 'Package left at door',
    type: String,
    required: false,
  })
  notes?: string;
}

export class RecordInspectionDtoDocs {
  @ApiProperty({
    description: 'Inspection result',
    example: 'accepted',
    enum: ['accepted', 'rejected'],
  })
  status: string;

  @ApiProperty({
    description: 'Inspection notes and observations',
    example: 'Item matches description and photos',
    type: String,
  })
  inspectionNotes: string;

  @ApiProperty({
    description: 'Optional inspection metadata',
    example: '{"photos": []}',
    type: String,
    required: false,
  })
  metadata?: string;
}

export class FileDisputeDtoDocs {
  @ApiProperty({
    description: 'Reason for dispute',
    example: 'Item does not match description',
    type: String,
  })
  reason: string;

  @ApiProperty({
    description: 'Optional evidence (links, descriptions)',
    example: 'Photo comparison: actual vs listed',
    type: String,
    required: false,
  })
  evidence?: string;
}

export class ResolveDisputeDtoDocs {
  @ApiProperty({
    description: 'Dispute resolution outcome',
    example: 'buyer_wins',
    enum: ['buyer_wins', 'seller_wins', 'refund'],
  })
  resolution: string;

  @ApiProperty({
    description: 'Admin notes explaining the resolution',
    example: 'Evidence supports buyer claim. Refunding full amount.',
    type: String,
  })
  adminNotes: string;
}

export class AdminForceCloseDtoDocs {
  @ApiProperty({
    description: 'Reason for force closing the escrow',
    example: 'Fraudulent activity detected',
    type: String,
  })
  reason: string;

  @ApiProperty({
    description: 'Action to take with escrowed funds',
    example: 'refund_buyer',
    enum: ['refund_buyer', 'release_seller', 'no_action'],
    required: false,
  })
  fundsAction?: string;
}