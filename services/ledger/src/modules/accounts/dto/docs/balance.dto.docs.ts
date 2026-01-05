import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDtoDocs {
  @ApiProperty({
    description: 'Account ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  accountId: string;

  @ApiProperty({
    description: 'Owner type',
    example: 'user',
    enum: ['user', 'platform'],
  })
  ownerType: string;

  @ApiProperty({
    description: 'Owner ID (user ID or null for platform)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    type: String,
    required: false,
  })
  ownerId?: string;

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
    description: 'Account purpose',
    example: 'spendable',
    enum: ['spendable', 'reserved', 'fees', 'treasury_hot'],
  })
  purpose: string;

  @ApiProperty({
    description: 'Current balance',
    example: 1000.5,
    type: Number,
  })
  balance: number;

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

export class UserBalancesResponseDtoDocs {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
    type: String,
  })
  userId: string;

  @ApiProperty({
    description: 'List of account balances',
    type: [BalanceResponseDtoDocs],
    isArray: true,
  })
  balances: BalanceResponseDtoDocs[];
}

