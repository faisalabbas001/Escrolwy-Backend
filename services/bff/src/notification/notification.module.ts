import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { AdminNotificationController } from './admin-notification.controller';
import { TemplateController } from './template.controller';

/**
 * Notification Module (BFF)
 * 
 * Groups all routes that proxy to Notification service:
 * - /api/v1/notifications/* (user endpoints)
 * - /api/v1/notifications/settings/:userId (admin endpoints)
 * - /api/v1/notifications/admin/* (admin endpoints)
 * - /api/v1/admin/templates/* (template management endpoints)
 * 
 * Note: Notification Service handles email notifications only.
 * Events are consumed via Kafka from other services (Escrow, Inquiry, etc.).
 */
@Module({
  controllers: [
    NotificationController,
    AdminNotificationController,
    TemplateController,
  ],
})
export class NotificationModule {}

