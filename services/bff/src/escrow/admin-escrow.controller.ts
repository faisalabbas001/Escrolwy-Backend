import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProxyService } from '../proxy';

/**
 * Admin Escrow Controller (BFF → Escrow Service)
 * 
 * Admin-only endpoints for escrow management.
 * All routes require JWT authentication with admin role (enforced by Escrow Service).
 * 
 * Routes:
 * - GET /api/v1/admin/escrows/all - Get all escrows (with pagination)
 * - GET /api/v1/admin/escrows/statistics - Get platform statistics
 * - GET /api/v1/admin/escrows/user/:userId - Get user's escrows
 * - POST /api/v1/admin/escrows/:id/resolve - Resolve dispute
 * - POST /api/v1/admin/escrows/:id/force-close - Force close escrow
 */
@ApiTags('admin/escrows')
@Controller({ path: 'admin/escrows', version: '1' })
export class AdminEscrowController {
  private readonly logger = new Logger(AdminEscrowController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Get all escrows (Admin only)
   * GET /api/v1/admin/escrows/all
   */
  @Get('all')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all escrows (admin only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Skip records (default: 0)' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Take records (default: 50)' })
  @ApiResponse({ status: 200, description: 'Escrows list retrieved successfully' })
  async getAllEscrows(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (skip) queryParams.append('skip', skip);
    if (take) queryParams.append('take', take);
    const queryString = queryParams.toString();
    const path = `/api/v1/escrows/all${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Escrow] GET ${path}`);
    return this.proxyService.proxyToEscrow(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get platform statistics (Admin only)
   * GET /api/v1/admin/escrows/statistics
   */
  @Get('statistics')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get platform statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Escrow] GET /api/v1/escrows/statistics');
    return this.proxyService.proxyToEscrow(
      'GET',
      '/api/v1/escrows/statistics',
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get specific user's escrows (Admin only)
   * GET /api/v1/admin/escrows/user/:userId
   */
  @Get('user/:userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user\'s escrows (admin only)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User escrows retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserEscrows(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] GET /api/v1/escrows/user/${userId}`);
    return this.proxyService.proxyToEscrow(
      'GET',
      `/api/v1/escrows/user/${userId}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Resolve dispute (Admin only)
   * POST /api/v1/admin/escrows/:id/resolve
   */
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Resolve dispute (admin only)' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Dispute resolved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async resolveDispute(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/resolve`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/resolve`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Force close escrow (Admin only)
   * POST /api/v1/admin/escrows/:id/force-close
   */
  @Post(':id/force-close')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Force close escrow (admin only)' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Escrow force closed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async adminForceClose(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/force-close`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/force-close`,
      body,
      { Authorization: authHeader },
    );
  }
}

