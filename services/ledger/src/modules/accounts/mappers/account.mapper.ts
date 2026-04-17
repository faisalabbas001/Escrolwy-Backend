import { Injectable } from '@nestjs/common';
import { BalanceResponseDto, UserBalancesResponseDto } from '../dto/balance-response.dto';
import { IAccountRepository } from '../../transfers/repository/interfaces';

/**
 * Account Mapper Service
 *
 * Single Responsibility: Maps account entities to DTOs
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class AccountMapperService {
  /**
   * Map account entity to BalanceResponseDto
   */
  toBalanceResponseDto(account: any, balance: number): BalanceResponseDto {
    return {
      accountId: account.id,
      ownerType: account.ownerType,
      ownerId: account.ownerId || undefined,
      asset: account.asset,
      chain: account.chain,
      purpose: account.purpose,
      balance,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Map account entities to UserBalancesResponseDto
   */
  toUserBalancesResponseDto(
    userId: string,
    accounts: Array<{
      id: string;
      ownerType: string;
      ownerId: string | null;
      asset: string;
      chain: string;
      purpose: string;
      balance: number;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ): UserBalancesResponseDto {
    return {
      userId,
      balances: accounts.map((account) => ({
        accountId: account.id,
        ownerType: account.ownerType,
        ownerId: account.ownerId || undefined,
        asset: account.asset,
        chain: account.chain,
        purpose: account.purpose,
        balance: account.balance,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })),
    };
  }
}

