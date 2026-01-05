import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { EmailModule } from "../email";
import { TemplateModule } from "../template";
import { PreferencesModule } from "../preferences";
import { ProcessedEventsModule } from "../processed-events";
import { AuthModule } from "../auth";
import { OutboxRepository, NotificationEventProducer } from "../kafka";

/**
 * Notifications Module
 *
 * Core notification orchestrator module.
 */
@Module({
  imports: [
    EmailModule,
    TemplateModule,
    PreferencesModule,
    ProcessedEventsModule,
    AuthModule,
  ],
  providers: [
    NotificationsService,
    OutboxRepository,
    NotificationEventProducer,
  ],
  exports: [NotificationsService, NotificationEventProducer],
})
export class NotificationsModule {}

