import { applyDecorators, HttpCode } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BalanceResponseDtoDocs, UserBalancesResponseDtoDocs } from '../dto/docs/balance.dto.docs';

/**
 * Get Account Balance endpoint
 * GET /ledger/accounts/:id/balance
 * @requires Authentication
 */
export function ApiGetAccountBalance() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiParam({
      name: 'id',
      description: 'Account ID',
      type: String,
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOperation({
      summary: 'Get account balance',
      description:
        'Retrieves the current balance for a specific account. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Balance retrieved successfully',
      type: BalanceResponseDtoDocs,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiResponse({
      status: 404,
      description: 'Account not found',
    }),
  );
}

/**
 * Get User Balances endpoint
 * GET /ledger/users/:id/balances
 * @requires Authentication
 */
export function ApiGetUserBalances() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiParam({
      name: 'id',
      description: 'User ID',
      type: String,
      example: '550e8400-e29b-41d4-a716-446655440001',
    }),
    ApiOperation({
      summary: 'Get user balances',
      description:
        'Retrieves all account balances for a specific user across all assets and chains. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Balances retrieved successfully',
      type: UserBalancesResponseDtoDocs,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
  );
}

