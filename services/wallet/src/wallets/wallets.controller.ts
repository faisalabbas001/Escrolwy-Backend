import {
  Controller,
  Get,
  Query,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import {
  UserWalletsResponseDto,
  PlatformWalletsResponseDto,
  PlatformWalletBalancesResponseDto,
} from './dto';

/**
 * Wallets Controller
 *
 * Read-only API for querying user wallets (public data only).
 * NEVER exposes private keys.
 */
@ApiTags('wallets')
@Controller({ path: 'wallets', version: '1' })
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  /**
   * Get wallets by user ID
   */
  @Get()
  @ApiOperation({
    summary: 'Get user wallets',
    description: 'Returns all wallets for a user with public keys only. Private keys are never exposed.',
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'User wallets (public data only)',
    type: UserWalletsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User has no wallets',
  })
  async getWallets(
    @Query('user_id', ParseUUIDPipe) userId: string,
  ): Promise<UserWalletsResponseDto> {
    const result = await this.walletsService.getWalletsByUserId(userId);

    if (!result) {
      throw new NotFoundException(`No wallets found for user ${userId}`);
    }

    return result;
  }

  /**
   * Get platform wallets (hot, cold, funding) for all chains
   */
  @Get('platform')
  @ApiOperation({
    summary: 'Get platform wallets',
    description: 'Returns all platform wallets (hot, cold, funding) for all chains. Only public addresses are exposed, private keys are never returned.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform wallets (public addresses only)',
    type: PlatformWalletsResponseDto,
  })
  async getPlatformWallets(): Promise<PlatformWalletsResponseDto> {
    return this.walletsService.getPlatformWallets();
  }

  /**
   * Get balances for all platform wallets (hot, cold, funding)
   */
  @Get('platform/balances')
  @ApiOperation({
    summary: 'Get platform wallet balances',
    description:
      'Returns balances for all platform wallets. Hot and cold wallets include native + token balances. Funding wallets include native balance only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform wallet balances',
    type: PlatformWalletBalancesResponseDto,
  })
  async getPlatformWalletBalances(): Promise<PlatformWalletBalancesResponseDto> {
    return this.walletsService.getPlatformWalletBalances();
  }
}
