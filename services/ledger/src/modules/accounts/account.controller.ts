import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { ServiceOnly } from '@escrowly/auth-common';
import { AccountService } from './account.service';
import { BalanceResponseDto, UserBalancesResponseDto } from './dto/balance-response.dto';
import {
  ApiGetAccountBalance,
  ApiGetUserBalances,
  // ApiBalanceCheck,
} from './docs/account.swagger';
import { AccountApiTag } from './docs/account.tags';

/**
 * Account Controller
 *
 * Handles all account and balance-related HTTP requests.
 * Protected by JwtAuthGuard globally.
 */
@AccountApiTag()
@Controller({
  path: 'ledger',
  version: '1',
})
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /**
   * Get account balance by account ID
   */
  @ApiGetAccountBalance()
  @Get('accounts/:id/balance')
  async getAccountBalance(
    @Param('id') accountId: string,
  ): Promise<BalanceResponseDto> {
    return this.accountService.getAccountBalance(accountId);
  }

  /**
   * Get all balances for a user
   */
  @ApiGetUserBalances()
  @Get('users/:id/balances')
  async getUserBalances(
    @Param('id') userId: string,
  ): Promise<UserBalancesResponseDto> {
    return this.accountService.getUserBalances(userId);
  }

  /**
   * Check if user has sufficient balance
   * INTERNAL API: Only accessible by other services with service API key
   * Used by Escrow service to validate balances before creating escrows
   */
  // @ApiBalanceCheck()
  @ServiceOnly()
  @Post('users/:id/balance-check')
  async checkBalance(
    @Param('id') userId: string,
    @Body() body: { amount: number; asset?: string; chain?: string },
  ): Promise<{ sufficient: boolean; available: number; required: number }> {
    return this.accountService.checkBalance(userId, body.amount, body.asset, body.chain);
  }
}

