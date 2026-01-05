import { ApiProperty } from '@nestjs/swagger';

export class CreateReservationDtoDocs {
  @ApiProperty({
    description: 'User ID who owns the funds',
    example: '11111111-1111-4111-8111-111111111111',
  })
  userId: string;

  @ApiProperty({
    description: 'Amount to reserve',
    example: 100.0,
    minimum: 0.000001,
  })
  amount: number;

  @ApiProperty({
    description: 'Reference for this reservation (e.g., escrow_id)',
    example: 'escrow-123',
  })
  reference: string;

  @ApiProperty({
    description: 'Idempotency key to prevent duplicate reservations',
    example: 'reservation-123-abc',
    required: false,
  })
  idempotencyKey?: string;

  @ApiProperty({
    description: 'Asset type (default: USDT)',
    example: 'USDT',
    required: false,
  })
  asset?: string;

  @ApiProperty({
    description: 'Chain (default: eth)',
    example: 'eth',
    required: false,
  })
  chain?: string;
}

export class ReservationResponseDtoDocs {
  @ApiProperty({
    description: 'Reservation ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  userId: string;

  @ApiProperty({
    description: 'Reserved amount',
    example: 100.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Reference',
    example: 'escrow-123',
  })
  reference: string;

  @ApiProperty({
    description: 'Reservation status',
    example: 'reserved',
    enum: ['reserved', 'released', 'cancelled'],
  })
  status: string;

  @ApiProperty({
    description: 'Idempotency key',
    example: 'reservation-123-abc',
    required: false,
  })
  idempotencyKey?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

