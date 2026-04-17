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
 * Notification Controller (BFF → Notification Service)
 * 
 * User-facing endpoints for notification management.
 * All routes require JWT authentication (enforced by global guard).
 * 
 * Routes:
 * - GET /api/v1/notifications/settings - Get current user's notification settings
 * - PUT /api/v1/notifications/settings - Update current user's notification settings
 * - GET /api/v1/notifications/user/:userId - Get notification history for user
 */
@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Get current user's notification settings
   * GET /api/v1/notifications/settings
   */
  @Get('settings')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user\'s notification settings' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'User ID (for testing without auth)' })
  @ApiResponse({ status: 200, description: 'Notification settings retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSettings(
    @Query('userId') userId?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (userId) queryParams.append('userId', userId);
    const queryString = queryParams.toString();
    const path = `/api/v1/notifications/settings${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Notification] GET ${path}`);
    return this.proxyService.proxyToNotification(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Update current user's notification settings
   * PUT /api/v1/notifications/settings
   */
  @Put('settings')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user\'s notification settings' })
  @ApiQuery({ name: 'userId', required: false, type: String, description: 'User ID (for testing without auth)' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSettings(
    @Body() body: any,
    @Query('userId') userId?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (userId) queryParams.append('userId', userId);
    const queryString = queryParams.toString();
    const path = `/api/v1/notifications/settings${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Notification] PUT ${path}`);
    return this.proxyService.proxyToNotification(
      'PUT',
      path,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Get notification history for user
   * GET /api/v1/notifications/user/:userId
   */
  @Get('user/:userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get notification history for user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Notification history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserNotifications(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Notification] GET /api/v1/notifications/user/${userId}`);
    return this.proxyService.proxyToNotification(
      'GET',
      `/api/v1/notifications/user/${userId}`,
      null,
      { Authorization: authHeader },
    );
  }
}

