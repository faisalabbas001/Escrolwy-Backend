import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
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
 * Escrow Controller (BFF → Escrow Service)
 * 
 * User-facing endpoints for escrow management.
 * All routes require JWT authentication (enforced by global guard).
 * 
 * Routes:
 * - POST /api/v1/escrows - Create escrow
 * - GET /api/v1/escrows/me - Get my escrows
 * - GET /api/v1/escrows/:id - Get escrow by ID
 * - GET /api/v1/escrows/:id/history - Get escrow history
 * - POST /api/v1/escrows/:id/accept - Accept escrow
 * - POST /api/v1/escrows/:id/payment - Process payment
 * - POST /api/v1/escrows/:id/delivery - Record delivery
 * - POST /api/v1/escrows/:id/inspection - Record inspection
 * - POST /api/v1/escrows/:id/complete - Complete escrow
 * - POST /api/v1/escrows/:id/cancel - Cancel escrow
 * - POST /api/v1/escrows/:id/dispute - File dispute
 */
@ApiTags('escrows')
@Controller({ path: 'escrows', version: '1' })
export class EscrowController {
  private readonly logger = new Logger(EscrowController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Create a new escrow
   * POST /api/v1/escrows
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new escrow' })
  @ApiResponse({ status: 201, description: 'Escrow created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  async createEscrow(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`[BFF] [${requestId}] ═══ INCOMING REQUEST: POST /api/v1/escrows ═══`);
    this.logger.log(`[BFF] [${requestId}] Request Body: ${JSON.stringify(body)}`);
    this.logger.log(`[BFF] [${requestId}] Authorization Header Received: ${authHeader ? `${authHeader.substring(0, 30)}...` : 'MISSING'}`);
    this.logger.log(`[BFF] [${requestId}] Authorization Header Type: ${typeof authHeader}`);
    this.logger.log(`[BFF] [${requestId}] Authorization Header Length: ${authHeader?.length || 0}`);
    
    if (!authHeader) {
      this.logger.error(`[BFF] [${requestId}] ❌ ERROR: Authorization header is missing`);
      this.logger.error(`[BFF] [${requestId}] Request will be rejected`);
      throw new HttpException('Authorization header is required', HttpStatus.UNAUTHORIZED);
    }
    
    // Extract token for logging (without exposing full token)
    const tokenPrefix = authHeader.startsWith('Bearer ') ? authHeader.substring(7, 20) : authHeader.substring(0, 13);
    this.logger.log(`[BFF] [${requestId}] JWT Token Prefix: ${tokenPrefix}...`);
    this.logger.log(`[BFF] [${requestId}] ────────────────────────────────────────────────────────────────`);
    this.logger.log(`[BFF] [${requestId}] → Proxying to Escrow Service: POST /api/v1/escrows`);
    this.logger.log(`[BFF] [${requestId}] → Headers being sent: { Authorization: "${authHeader.substring(0, 30)}..." }`);
    
    try {
      const response = await this.proxyService.proxyToEscrow(
        'POST',
        '/api/v1/escrows',
        body,
        { Authorization: authHeader },
      );
      
      this.logger.log(`[BFF] [${requestId}] ✅ SUCCESS: Received response from Escrow Service`);
      this.logger.log(`[BFF] [${requestId}] Response: ${JSON.stringify(response)}`);
      this.logger.log(`[BFF] [${requestId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      return response;
    } catch (error) {
      this.logger.error(`[BFF] [${requestId}] ❌ ERROR: Failed to proxy request to Escrow Service`);
      this.logger.error(`[BFF] [${requestId}] Error Status: ${error?.status || 'UNKNOWN'}`);
      this.logger.error(`[BFF] [${requestId}] Error Message: ${error?.message || 'UNKNOWN'}`);
      this.logger.error(`[BFF] [${requestId}] Error Response: ${JSON.stringify(error?.response?.data || {})}`);
      this.logger.error(`[BFF] [${requestId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      throw error;
    }
  }

  /**
   * Get current user's escrows
   * GET /api/v1/escrows/me
   */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user\'s escrows' })
  @ApiResponse({ status: 200, description: 'Escrows retrieved successfully' })
  async getMyEscrows(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Escrow] GET /api/v1/escrows/me');
    return this.proxyService.proxyToEscrow(
      'GET',
      '/api/v1/escrows/me',
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get escrow history
   * GET /api/v1/escrows/:id/history
   * 
   * Note: This route must come before :id to ensure correct matching
   */
  @Get(':id/history')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get escrow history' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Skip records (default: 0)' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Take records (default: 50)' })
  @ApiResponse({ status: 200, description: 'Escrow history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async getEscrowHistory(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (skip) queryParams.append('skip', skip);
    if (take) queryParams.append('take', take);
    const queryString = queryParams.toString();
    const path = `/api/v1/escrows/${id}/history${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Escrow] GET ${path}`);
    return this.proxyService.proxyToEscrow(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get escrow by ID
   * GET /api/v1/escrows/:id
   */
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get escrow by ID' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Escrow retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async getEscrow(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] GET /api/v1/escrows/${id}`);
    return this.proxyService.proxyToEscrow(
      'GET',
      `/api/v1/escrows/${id}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Accept escrow agreement
   * POST /api/v1/escrows/:id/accept
   */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Accept escrow agreement' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Escrow accepted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async acceptEscrow(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/accept`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/accept`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Process payment
   * POST /api/v1/escrows/:id/payment
   */
  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Process payment for escrow' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid payment' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async processPayment(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/payment`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/payment`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Record delivery
   * POST /api/v1/escrows/:id/delivery
   */
  @Post(':id/delivery')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Record delivery for escrow' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Delivery recorded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async recordDelivery(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/delivery`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/delivery`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Record inspection
   * POST /api/v1/escrows/:id/inspection
   */
  @Post(':id/inspection')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Record inspection results for escrow' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Inspection recorded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async recordInspection(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/inspection`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/inspection`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Complete escrow
   * POST /api/v1/escrows/:id/complete
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Complete escrow' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Escrow completed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async completeEscrow(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/complete`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/complete`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Cancel escrow
   * POST /api/v1/escrows/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel escrow' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Escrow cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async cancelEscrow(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/cancel`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/cancel`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * File dispute
   * POST /api/v1/escrows/:id/dispute
   */
  @Post(':id/dispute')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'File dispute for escrow' })
  @ApiParam({ name: 'id', description: 'Escrow UUID' })
  @ApiResponse({ status: 200, description: 'Dispute filed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid operation' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async fileDispute(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Escrow] POST /api/v1/escrows/${id}/dispute`);
    return this.proxyService.proxyToEscrow(
      'POST',
      `/api/v1/escrows/${id}/dispute`,
      body,
      { Authorization: authHeader },
    );
  }
}

