import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Single Wallet Response DTO (public data only)
 */
export class WalletResponseDto {
  @ApiProperty({
    description: 'Unique wallet ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Blockchain chain identifier',
    example: 'evm',
    enum: ['evm', 'sol', 'trc'],
  })
  chain: string;

  @ApiProperty({
    description: 'Deposit address (public)',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  depositAddress: string;

  @ApiPropertyOptional({
    description: 'Public key (if available, for Solana/Tron)',
    example: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  })
  publicKey?: string;

  @ApiProperty({
    description: 'Wallet creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: string;
}

/**
 * User Wallets Response DTO
 */
export class UserWalletsResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'List of user wallets (all chains)',
    type: [WalletResponseDto],
  })
  wallets: WalletResponseDto[];
}

/**
 * Single Platform Wallet Response DTO (public data only)
 */
export class PlatformWalletResponseDto {
  @ApiProperty({
    description: 'Blockchain chain identifier',
    example: 'evm',
    enum: ['evm', 'sol', 'trc'],
  })
  chain: string;

  @ApiProperty({
    description: 'Wallet type',
    example: 'hot',
    enum: ['hot', 'funding', 'cold'],
  })
  walletType: string;

  @ApiProperty({
    description: 'Public wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  publicAddress: string;
}

/**
 * Platform Wallets by Type Response DTO
 */
export class PlatformWalletsByTypeDto {
  @ApiProperty({
    description: 'Hot wallets (all chains)',
    type: [PlatformWalletResponseDto],
  })
  hot: PlatformWalletResponseDto[];

  @ApiProperty({
    description: 'Cold wallets (all chains)',
    type: [PlatformWalletResponseDto],
  })
  cold: PlatformWalletResponseDto[];

  @ApiProperty({
    description: 'Funding wallets (all chains)',
    type: [PlatformWalletResponseDto],
  })
  funding: PlatformWalletResponseDto[];
}

/**
 * Platform Wallets Response DTO
 */
export class PlatformWalletsResponseDto {
  @ApiProperty({
    description: 'Platform wallets organized by type',
    type: PlatformWalletsByTypeDto,
  })
  wallets: PlatformWalletsByTypeDto;

  @ApiProperty({
    description: 'Total number of platform wallets',
    example: 9,
  })
  total: number;
}

// =============================================================================
// BALANCE DTOs
// =============================================================================

/**
 * Token Balance DTO
 */
export class TokenBalanceDto {
  @ApiProperty({
    description: 'Token symbol',
    example: 'USDT',
  })
  symbol: string;

  @ApiProperty({
    description: 'Token balance (human-readable)',
    example: '1000.50',
  })
  balance: string;

  @ApiProperty({
    description: 'Token decimals',
    example: 6,
  })
  decimals: number;
}

/**
 * Chain Balance DTO (native + tokens)
 */
export class ChainBalanceDto {
  @ApiProperty({
    description: 'Chain identifier',
    example: 'evm',
    enum: ['evm', 'sol', 'trc'],
  })
  chain: string;

  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  address: string;

  @ApiProperty({
    description: 'Native token balance (ETH/SOL/TRX)',
    example: '1.5',
  })
  nativeBalance: string;

  @ApiProperty({
    description: 'Native token symbol',
    example: 'ETH',
  })
  nativeSymbol: string;

  @ApiPropertyOptional({
    description: 'Token balances (for hot/cold wallets)',
    type: [TokenBalanceDto],
  })
  tokens?: TokenBalanceDto[];
}

/**
 * Wallet Balances DTO (single wallet type with all chains)
 */
export class WalletBalancesDto {
  @ApiProperty({
    description: 'Wallet type',
    example: 'hot',
    enum: ['hot', 'cold', 'funding'],
  })
  walletType: string;

  @ApiProperty({
    description: 'Balances per chain',
    type: [ChainBalanceDto],
  })
  chains: ChainBalanceDto[];
}

/**
 * Platform Wallet Balances Response DTO
 */
export class PlatformWalletBalancesResponseDto {
  @ApiProperty({
    description: 'Hot wallet balances (native + tokens)',
    type: WalletBalancesDto,
  })
  hot: WalletBalancesDto;

  @ApiProperty({
    description: 'Cold wallet balances (native + tokens)',
    type: WalletBalancesDto,
  })
  cold: WalletBalancesDto;

  @ApiProperty({
    description: 'Funding wallet balances (native only)',
    type: WalletBalancesDto,
  })
  funding: WalletBalancesDto;

  @ApiProperty({
    description: 'Timestamp when balances were fetched',
    example: '2024-01-15T10:30:00.000Z',
  })
  fetchedAt: string;
}
