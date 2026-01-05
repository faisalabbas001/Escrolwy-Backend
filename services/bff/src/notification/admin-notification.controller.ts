import {
  Controller,
  Get,
  Put,
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
 * Admin Notification Controller (BFF → Notification Service)
 * 
 * Admin-only endpoints for notification management.
 * All routes require JWT authentication with admin role (enforced by Notification Service).
 * 
 * Routes:
 * - GET /api/v1/notifications/settings/:userId - Get user notification settings (admin)
 * - PUT /api/v1/notifications/settings/:userId - Update user notification settings (admin)
 * - GET /api/v1/notifications/admin/logs - Query notification logs (admin)
 * - POST /api/v1/notifications/test-send - Send test email (admin)
 * - POST /api/v1/notifications/retry/:notificationId - Retry failed notification (admin)
 */
@ApiTags('admin/notifications')
@Controller({ path: 'notifications', version: '1' })
export class AdminNotificationController {
  private readonly logger = new Logger(AdminNotificationController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Get user notification settings (admin)
   * GET /api/v1/notifications/settings/:userId
   */
  @Get('settings/:userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user notification settings (admin only)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserSettings(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Notification] GET /api/v1/notifications/settings/${userId}`);
    return this.proxyService.proxyToNotification(
      'GET',
      `/api/v1/notifications/settings/${userId}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Update user notification settings (admin)
   * PUT /api/v1/notifications/settings/:userId
   */
  @Put('settings/:userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user notification settings (admin only)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserSettings(
    @Param('userId') userId: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Notification] PUT /api/v1/notifications/settings/${userId}`);
    return this.proxyService.proxyToNotification(
      'PUT',
      `/api/v1/notifications/settings/${userId}`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Query notification logs (admin)
   * GET /api/v1/notifications/admin/logs
   */
  @Get('admin/logs')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Query notification logs (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
  @ApiQuery({ name: 'eventType', required: false, type: String, description: 'Filter by event type' })
  @ApiQuery({ name: 'eventKey', required: false, type: String, description: 'Filter by event key' })
  @ApiQuery({ name: 'status', required: false, enum: ['sent', 'failed', 'skipped'], description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('eventType') eventType?: string,
    @Query('eventKey') eventKey?: string,
    @Query('status') status?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (userId) queryParams.append('userId', userId);
    if (eventType) queryParams.append('eventType', eventType);
    if (eventKey) queryParams.append('eventKey', eventKey);
    if (status) queryParams.append('status', status);
    const queryString = queryParams.toString();
    const path = `/api/v1/notifications/admin/logs${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Notification] GET ${path}`);
    return this.proxyService.proxyToNotification(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Send test email (admin)
   * POST /api/v1/notifications/test-send
   */
  @Post('test-send')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send test email (admin only)' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  async testSend(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Notification] POST /api/v1/notifications/test-send');
    return this.proxyService.proxyToNotification(
      'POST',
      '/api/v1/notifications/test-send',
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Retry failed notification (admin)
   * POST /api/v1/notifications/retry/:notificationId
   */
  @Post('retry/:notificationId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Retry failed notification (admin only)' })
  @ApiParam({ name: 'notificationId', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification retry initiated successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async retryNotification(
    @Param('notificationId') notificationId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Notification] POST /api/v1/notifications/retry/${notificationId}`);
    return this.proxyService.proxyToNotification(
      'POST',
      `/api/v1/notifications/retry/${notificationId}`,
      null,
      { Authorization: authHeader },
    );
  }
}

