import { Injectable, Logger } from '@nestjs/common';
import { AccountRepository } from '../transfers/repository/account.repository';
import { BalanceResponseDto, UserBalancesResponseDto } from './dto/balance-response.dto';
import { AccountMapperService } from './mappers/account.mapper';
import { AccountValidatorService } from './validators/account.validator';

/**
 * Account Service
 *
 * Single Responsibility: Orchestrates account and balance operations
 * Follows Single Responsibility Principle (SRP)
 * Follows Dependency Inversion Principle (DIP) - depends on concrete classes that implement interfaces
 *
 * Note: While we inject concrete classes (required by NestJS DI), they implement interfaces
 * which provides type safety and allows for easy substitution in tests or future implementations.
 *
 * Coordinates:
 * - Validation (via AccountValidatorService)
 * - Data retrieval (via AccountRepository)
 * - DTO mapping (via AccountMapperService)
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly validator: AccountValidatorService,
    private readonly mapper: AccountMapperService,
  ) {}

  /**
   * Get account balance by account ID
   */
  async getAccountBalance(accountId: string): Promise<BalanceResponseDto> {
    const account = await this.accountRepository.findById(accountId);
    this.validator.validateAccountExists(account, accountId);

    const balance = await this.accountRepository.getBalance(accountId);

    return this.mapper.toBalanceResponseDto(account, balance);
  }

  /**
   * Get all balances for a user
   */
  async getUserBalances(userId: string): Promise<UserBalancesResponseDto> {
    const accounts = await this.accountRepository.getUserBalances(userId);

    return this.mapper.toUserBalancesResponseDto(userId, accounts);
  }

  /**
   * Check if user has sufficient balance
   */
  async checkBalance(
    userId: string,
    requiredAmount: number,
    asset: string = 'USDT',
    chain: string = 'eth',
  ): Promise<{ sufficient: boolean; available: number; required: number }> {
    const accounts = await this.accountRepository.findByUserId(userId);
    const spendableAccount = accounts.find(
      (acc) => acc.purpose === 'spendable' && acc.asset === asset && acc.chain === chain,
    );

    if (!spendableAccount) {
      return {
        sufficient: false,
        available: 0,
        required: requiredAmount,
      };
    }

    const balance = await this.accountRepository.getBalance(spendableAccount.id);

    return {
      sufficient: balance >= requiredAmount,
      available: balance,
      required: requiredAmount,
    };
  }
}

