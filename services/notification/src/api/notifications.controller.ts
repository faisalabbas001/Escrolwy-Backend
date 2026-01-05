import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser, Roles, Role } from "@escrowly/auth-common";
import { PrismaService } from "../prisma";
import { PreferencesMapperService } from "../preferences/preferences-mapper.service";
import { EmailService } from "../email";
import { NotificationsService } from "../notifications/notifications.service";
import {
  UpdateNotificationSettingsDto,
  NotificationSettingsResponseDto,
  TestEmailDto,
  NotificationLogListResponseDto,
  NotificationLogResponseDto,
} from "./dto";

/**
 * Notifications API Controller
 *
 * User APIs:
 * - Get/update notification settings (current user)
 * - Get notification history (read-only audit view)
 *
 * Admin APIs:
 * - Get/update user settings by userId
 * - Query logs
 * - Send test email
 * - Retry failed notification
 *
 * Rules:
 * - Email-only scope (no SMS/Push/WebSocket)
 * - APIs never send emails directly (except test-send for admin)
 * - Notification history is read-only audit view over notification_logs
 */
@ApiTags("notifications")
@Controller({
  path: "notifications",
  version: "1",
})
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preferencesMapper: PreferencesMapperService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService
  ) {}

  // ====================================
  // User Notification Settings APIs
  // ====================================

  /**
   * Get current user's notification settings
   * Endpoint: GET /api/v1/notifications/settings
   */
  @Get("settings")
  @ApiOperation({ summary: "Get current user's notification settings" })
  @ApiResponse({
    status: 200,
    description: "Notification settings",
    type: NotificationSettingsResponseDto,
  })
  async getMySettings(
    @CurrentUser("id") userId: string | null,
    @Query("userId") testUserId?: string
  ): Promise<NotificationSettingsResponseDto> {
    // For testing without auth: use testUserId from query param
    const effectiveUserId = userId || testUserId || "test-user-id";
    const settings = await this.prisma.userNotificationSettings.findUnique({
      where: { userId: effectiveUserId },
    });

    if (!settings) {
      // Return defaults
      return {
        userId: effectiveUserId,
        preferences: {
          transaction_events: true,
          account_events: true,
          milestone_events: true,
          marketing_emails: false,
        },
      };
    }

    return {
      userId: effectiveUserId,
      preferences: this.preferencesMapper.dbToApi(settings),
    };
  }

  /**
   * Update current user's notification settings
   * Endpoint: PUT /api/v1/notifications/settings
   * For testing: Include userId in body or query param
   */
  @Put("settings")
  @ApiOperation({ summary: "Update current user's notification settings" })
  @ApiResponse({
    status: 200,
    description: "Settings updated",
    type: NotificationSettingsResponseDto,
  })
  async updateMySettings(
    @CurrentUser("id") userId: string | null,
    @Body() dto: UpdateNotificationSettingsDto,
    @Query("userId") testUserId?: string
  ): Promise<NotificationSettingsResponseDto> {
    // For testing without auth: use testUserId from query param
    const effectiveUserId = userId || testUserId || "test-user-id";
    const dbFields = this.preferencesMapper.apiToDb(dto.preferences);

    const settings = await this.prisma.userNotificationSettings.upsert({
      where: { userId: effectiveUserId },
      create: {
        userId: effectiveUserId,
        ...dbFields,
      },
      update: dbFields,
    });

    return {
      userId: effectiveUserId,
      preferences: this.preferencesMapper.dbToApi(settings),
    };
  }

  // ====================================
  // Admin APIs (Protected with @Roles)
  // ====================================

  /**
   * Get user notification settings by userId (admin)
   * Endpoint: GET /api/v1/notifications/settings/:userId
   */
  @Get("settings/:userId")
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @ApiOperation({ summary: "Get user notification settings by userId (admin)" })
  @ApiResponse({
    status: 200,
    description: "Notification settings",
    type: NotificationSettingsResponseDto,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async getSettings(
    @Param("userId", ParseUUIDPipe) userId: string
  ): Promise<NotificationSettingsResponseDto> {
    const settings = await this.prisma.userNotificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Return defaults (user exists but no settings)
      return {
        userId,
        preferences: {
          transaction_events: true,
          account_events: true,
          milestone_events: true,
          marketing_emails: false,
        },
      };
    }

    return {
      userId,
      preferences: this.preferencesMapper.dbToApi(settings),
    };
  }

  /**
   * Update user notification settings by userId (admin)
   * Endpoint: PUT /api/v1/notifications/settings/:userId
   */
  @Put("settings/:userId")
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @ApiOperation({ summary: "Update user notification settings by userId (admin)" })
  @ApiResponse({
    status: 200,
    description: "Settings updated",
    type: NotificationSettingsResponseDto,
  })
  async updateSettings(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: UpdateNotificationSettingsDto
  ): Promise<NotificationSettingsResponseDto> {
    const dbFields = this.preferencesMapper.apiToDb(dto.preferences);

    const settings = await this.prisma.userNotificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...dbFields,
      },
      update: dbFields,
    });

    return {
      userId,
      preferences: this.preferencesMapper.dbToApi(settings),
    };
  }

  /**
   * Get user notification history (read-only audit view)
   * Endpoint: GET /api/v1/notifications/user/:userId
   *
   * Note: This is a read-only audit view over notification_logs.
   * For email-only scope, there's no "unread" concept - emails are sent, not stored as notifications.
   */
  @Get("user/:userId")
  @ApiOperation({
    summary: "Get user notification history (read-only audit view)",
    description:
      "Returns email delivery logs for the user. This is a read-only audit view - emails are sent, not stored as 'unread notifications'.",
  })
  @ApiResponse({
    status: 200,
    description: "Notification history",
    type: NotificationLogListResponseDto,
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  async getHistory(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "20"
  ): Promise<NotificationLogListResponseDto> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException(
        "Invalid pagination: page must be >= 1, limit must be between 1 and 100"
      );
    }

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      this.prisma.notificationLog.count({ where: { userId } }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        eventType: log.eventType,
        eventKey: log.eventKey,
        templateId: log.templateId,
        recipientEmail: log.recipientEmail,
        subject: log.subject,
        status: log.status,
        errorMessage: log.errorMessage,
        resendId: log.resendId,
        createdAt: log.createdAt,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  /**
   * Admin: Query notification logs
   * Endpoint: GET /api/v1/notifications/admin/logs
   */
  @Get("admin/logs")
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @ApiOperation({ summary: "Admin: Query notification logs" })
  @ApiResponse({
    status: 200,
    description: "Notification logs",
    type: NotificationLogListResponseDto,
  })
  @ApiQuery({ name: "status", required: false, enum: ["sent", "failed", "skipped"] })
  @ApiQuery({ name: "eventType", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String, description: "Filter by user ID" })
  @ApiQuery({ name: "eventKey", required: false, type: String, description: "Filter by event key (for idempotency tracking)" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 50 })
  async getLogs(
    @Query("status") status?: string,
    @Query("eventType") eventType?: string,
    @Query("userId") userId?: string,
    @Query("eventKey") eventKey?: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "50"
  ): Promise<NotificationLogListResponseDto> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException(
        "Invalid pagination: page must be >= 1, limit must be between 1 and 100"
      );
    }

    const where: any = {};
    if (status) {
      if (!["sent", "failed", "skipped"].includes(status)) {
        throw new BadRequestException(
          `Invalid status: ${status}. Must be one of: sent, failed, skipped`
        );
      }
      where.status = status;
    }
    if (eventType) where.eventType = eventType;
    if (userId) where.userId = userId;
    if (eventKey) where.eventKey = eventKey;

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        eventType: log.eventType,
        eventKey: log.eventKey,
        templateId: log.templateId,
        recipientEmail: log.recipientEmail,
        subject: log.subject,
        status: log.status,
        errorMessage: log.errorMessage,
        resendId: log.resendId,
        createdAt: log.createdAt,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  /**
   * Admin: Send test email
   * Endpoint: POST /api/v1/notifications/test-send
   *
   * Note: This is the only API endpoint that sends emails directly (bypasses Kafka).
   * Used for testing email delivery and Resend integration.
   */
  @Post("test-send")
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @ApiOperation({
    summary: "Admin: Send test email",
    description:
      "Sends a test email directly via Resend (bypasses Kafka). Used for testing email delivery.",
  })
  @ApiResponse({
    status: 200,
    description: "Test email sent",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        resendId: { type: "string", example: "re_abc123" },
        message: { type: "string", example: "Test email sent successfully" },
      },
    },
  })
  async testSend(@Body() dto: TestEmailDto) {
    try {
      const resendId = await this.emailService.sendEmail(
        dto.to,
        dto.subject,
        dto.html
      );

      return {
        success: true,
        resendId,
        message: "Test email sent successfully",
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      throw new BadRequestException(`Failed to send test email: ${errorMsg}`);
    }
  }

  /**
   * Admin: Retry failed notification
   * Endpoint: POST /api/v1/notifications/retry/:notificationId
   *
   * Retries a failed notification by re-sending the email via Resend.
   * Only retries transient failures (network errors, 5xx responses).
   * Does not retry business failures (user opted out, invalid email).
   */
  @Post("retry/:notificationId")
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Admin: Retry failed notification",
    description:
      "Retries a failed notification by re-sending the email. Only retries transient failures.",
  })
  @ApiResponse({
    status: 200,
    description: "Retry initiated",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Notification retried successfully" },
        notificationId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
        resendId: { type: "string", example: "re_abc123" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Notification not found" })
  @ApiResponse({ status: 400, description: "Cannot retry (business failure or not failed)" })
  async retryNotification(
    @Param("notificationId", ParseUUIDPipe) notificationId: string
  ) {
    try {
      const resendId = await this.notificationsService.retryFailedNotification(
        notificationId
      );

      return {
        success: true,
        message: "Notification retried successfully",
        notificationId,
        resendId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      if (errorMsg.includes("not found")) {
        throw new NotFoundException(errorMsg);
      }

      throw new BadRequestException(`Failed to retry notification: ${errorMsg}`);
    }
  }
}
