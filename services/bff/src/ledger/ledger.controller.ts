import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProxyService } from '../proxy';

/**
 * Ledger Controller (BFF → Ledger Service)
 * 
 * User-facing endpoints for ledger and account management.
 * All routes require JWT authentication (enforced by global guard).
 * 
 * Note: Internal-only endpoints (balance-check, reservations) are NOT exposed
 * through BFF as they require service-to-service authentication.
 * 
 * Routes:
 * - GET /api/v1/ledger/accounts/:id/balance - Get account balance
 * - GET /api/v1/ledger/users/:id/balances - Get user balances
 * - POST /api/v1/ledger/transfers - Create transfer
 * - GET /api/v1/ledger/transfers/:id - Get transfer
 * - POST /api/v1/ledger/internal/transfer - Create internal transfer
 * - GET /api/v1/ledger/internal/transfer/:id - Get internal transfer
 * - POST /api/v1/ledger/external/transfer - Create external transfer
 * - GET /api/v1/ledger/external/transfer/:id - Get external transfer
 */
@ApiTags('ledger')
@Controller({ path: 'ledger', version: '1' })
export class LedgerController {
  private readonly logger = new Logger(LedgerController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Get account balance by account ID
   * GET /api/v1/ledger/accounts/:id/balance
   */
  @Get('accounts/:id/balance')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get account balance by account ID' })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Account balance retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountBalance(
    @Param('id') accountId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Ledger] GET /api/v1/ledger/accounts/${accountId}/balance`);
    return this.proxyService.proxyToLedger(
      'GET',
      `/api/v1/ledger/accounts/${accountId}/balance`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get all balances for a user
   * GET /api/v1/ledger/users/:id/balances
   */
  @Get('users/:id/balances')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all balances for a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User balances retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserBalances(
    @Param('id') userId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Ledger] GET /api/v1/ledger/users/${userId}/balances`);
    return this.proxyService.proxyToLedger(
      'GET',
      `/api/v1/ledger/users/${userId}/balances`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Create a new transfer
   * POST /api/v1/ledger/transfers
   */
  @Post('transfers')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new transfer' })
  @ApiResponse({ status: 201, description: 'Transfer created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  async createTransfer(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Ledger] POST /api/v1/ledger/transfers');
    return this.proxyService.proxyToLedger(
      'POST',
      '/api/v1/ledger/transfers',
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Get transfer by ID
   * GET /api/v1/ledger/transfers/:id
   */
  @Get('transfers/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get transfer by ID' })
  @ApiParam({ name: 'id', description: 'Transfer UUID' })
  @ApiResponse({ status: 200, description: 'Transfer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  async getTransfer(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Ledger] GET /api/v1/ledger/transfers/${id}`);
    return this.proxyService.proxyToLedger(
      'GET',
      `/api/v1/ledger/transfers/${id}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Create a new internal transfer (user-to-user)
   * POST /api/v1/ledger/internal/transfer
   */
  @Post('internal/transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new internal transfer (user-to-user)' })
  @ApiResponse({ status: 201, description: 'Internal transfer created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  async createInternalTransfer(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Ledger] POST /api/v1/ledger/internal/transfer');
    return this.proxyService.proxyToLedger(
      'POST',
      '/api/v1/ledger/internal/transfer',
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Get internal transfer by ID
   * GET /api/v1/ledger/internal/transfer/:id
   */
  @Get('internal/transfer/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get internal transfer by ID' })
  @ApiParam({ name: 'id', description: 'Internal transfer UUID' })
  @ApiResponse({ status: 200, description: 'Internal transfer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Internal transfer not found' })
  async getInternalTransfer(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Ledger] GET /api/v1/ledger/internal/transfer/${id}`);
    return this.proxyService.proxyToLedger(
      'GET',
      `/api/v1/ledger/internal/transfer/${id}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Create a new external transfer
   * POST /api/v1/ledger/external/transfer
   */
  @Post('external/transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new external transfer' })
  @ApiResponse({ status: 201, description: 'External transfer created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  async createExternalTransfer(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Ledger] POST /api/v1/ledger/external/transfer');
    return this.proxyService.proxyToLedger(
      'POST',
      '/api/v1/ledger/external/transfer',
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Get external transfer by ID
   * GET /api/v1/ledger/external/transfer/:id
   */
  @Get('external/transfer/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get external transfer by ID' })
  @ApiParam({ name: 'id', description: 'External transfer UUID' })
  @ApiResponse({ status: 200, description: 'External transfer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'External transfer not found' })
  async getExternalTransfer(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Ledger] GET /api/v1/ledger/external/transfer/${id}`);
    return this.proxyService.proxyToLedger(
      'GET',
      `/api/v1/ledger/external/transfer/${id}`,
      null,
      { Authorization: authHeader },
    );
  }
}

