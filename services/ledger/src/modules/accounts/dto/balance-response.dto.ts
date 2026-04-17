/**
 * Balance Response DTO
 *
 * Response body for balance queries
 */
export class BalanceResponseDto {
  accountId: string;
  ownerType: string;
  ownerId?: string;
  asset: string;
  chain: string;
  purpose: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Balances Response DTO
 *
 * Response body for user balance queries
 */
export class UserBalancesResponseDto {
  userId: string;
  balances: BalanceResponseDto[];
}

