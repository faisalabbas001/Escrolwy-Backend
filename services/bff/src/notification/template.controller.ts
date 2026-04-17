import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
 * Template Controller (BFF → Notification Service)
 * 
 * Admin-only endpoints for email template management.
 * All routes require JWT authentication with admin role (enforced by Notification Service).
 * 
 * Routes:
 * - GET /api/v1/admin/templates - List all templates
 * - GET /api/v1/admin/templates/:templateId - Get template by ID
 * - POST /api/v1/admin/templates - Register new template
 * - PUT /api/v1/admin/templates/:templateId - Update template
 * - DELETE /api/v1/admin/templates/:templateId - Delete template
 */
@ApiTags('admin/templates')
@Controller({ path: 'admin/templates', version: '1' })
export class TemplateController {
  private readonly logger = new Logger(TemplateController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * List all templates
   * GET /api/v1/admin/templates
   */
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all registered email templates' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  async listTemplates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    const queryString = queryParams.toString();
    const path = `/api/v1/admin/templates${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Notification] GET ${path}`);
    return this.proxyService.proxyToNotification(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get template by ID
   * GET /api/v1/admin/templates/:templateId
   */
  @Get(':templateId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiParam({ name: 'templateId', description: 'Template identifier' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(
    @Param('templateId') templateId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Notification] GET /api/v1/admin/templates/${templateId}`);
    return this.proxyService.proxyToNotification(
      'GET',
      `/api/v1/admin/templates/${templateId}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Register new template
   * POST /api/v1/admin/templates
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register a new email template' })
  @ApiResponse({ status: 201, description: 'Template registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 409, description: 'Template with this templateId already exists' })
  async createTemplate(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Notification] POST /api/v1/admin/templates');
    return this.proxyService.proxyToNotification(
      'POST',
      '/api/v1/admin/templates',
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Update template
   * PUT /api/v1/admin/templates/:templateId
   */
  @Put(':templateId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update existing template metadata' })
  @ApiParam({ name: 'templateId', description: 'Template identifier' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Notification] PUT /api/v1/admin/templates/${templateId}`);
    return this.proxyService.proxyToNotification(
      'PUT',
      `/api/v1/admin/templates/${templateId}`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Delete template
   * DELETE /api/v1/admin/templates/:templateId
   */
  @Delete(':templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete template' })
  @ApiParam({ name: 'templateId', description: 'Template identifier' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(
    @Param('templateId') templateId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Notification] DELETE /api/v1/admin/templates/${templateId}`);
    return this.proxyService.proxyToNotification(
      'DELETE',
      `/api/v1/admin/templates/${templateId}`,
      null,
      { Authorization: authHeader },
    );
  }
}

