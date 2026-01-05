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
 * Admin Inquiry Controller (BFF → Inquiry Service)
 * 
 * Admin-only endpoints for inquiry management.
 * All routes require JWT authentication with admin role (enforced by Inquiry Service).
 * 
 * Routes:
 * - GET /api/v1/admin/inquiries - List all inquiries (admin)
 * - GET /api/v1/admin/inquiries/:id - Get inquiry detail (admin)
 * - POST /api/v1/admin/inquiries/:id/assign - Assign inquiry to admin
 * - POST /api/v1/admin/inquiries/:id/resolve - Resolve inquiry
 */
@ApiTags('admin/inquiries')
@Controller({ path: 'admin/inquiries', version: '1' })
export class AdminInquiryController {
  private readonly logger = new Logger(AdminInquiryController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * List all inquiries (admin)
   * GET /api/v1/admin/inquiries
   */
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all inquiries (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'resolved', 'closed'], description: 'Filter by status' })
  @ApiQuery({ name: 'assignedAdminId', required: false, type: String, description: 'Filter by assigned admin' })
  @ApiResponse({ status: 200, description: 'Inquiries list retrieved successfully' })
  async listInquiries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (status) queryParams.append('status', status);
    if (assignedAdminId) queryParams.append('assignedAdminId', assignedAdminId);
    const queryString = queryParams.toString();
    const path = `/api/v1/admin/inquiries${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Inquiry] GET ${path}`);
    return this.proxyService.proxyToInquiry(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get inquiry detail (admin)
   * GET /api/v1/admin/inquiries/:id
   */
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get inquiry full detail (admin only)' })
  @ApiParam({ name: 'id', description: 'Inquiry UUID' })
  @ApiResponse({ status: 200, description: 'Inquiry detail retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async getInquiryDetail(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] GET /api/v1/admin/inquiries/${id}`);
    return this.proxyService.proxyToInquiry(
      'GET',
      `/api/v1/admin/inquiries/${id}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Assign inquiry to admin
   * POST /api/v1/admin/inquiries/:id/assign
   */
  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Assign inquiry to admin' })
  @ApiParam({ name: 'id', description: 'Inquiry UUID' })
  @ApiResponse({ status: 200, description: 'Inquiry assigned successfully' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async assignInquiry(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] POST /api/v1/admin/inquiries/${id}/assign`);
    return this.proxyService.proxyToInquiry(
      'POST',
      `/api/v1/admin/inquiries/${id}/assign`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Resolve inquiry
   * POST /api/v1/admin/inquiries/:id/resolve
   */
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Resolve inquiry as admin' })
  @ApiParam({ name: 'id', description: 'Inquiry UUID' })
  @ApiResponse({ status: 200, description: 'Inquiry resolved successfully' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async resolveInquiry(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] POST /api/v1/admin/inquiries/${id}/resolve`);
    return this.proxyService.proxyToInquiry(
      'POST',
      `/api/v1/admin/inquiries/${id}/resolve`,
      body,
      { Authorization: authHeader },
    );
  }
}

