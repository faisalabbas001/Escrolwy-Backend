import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { PreferencesModule } from "../preferences";
import { EmailModule } from "../email";
import { NotificationsModule } from "../notifications";

/**
 * API Module
 *
 * REST API endpoints for notifications.
 */
@Module({
  imports: [PreferencesModule, EmailModule, NotificationsModule],
  controllers: [NotificationsController],
})
export class ApiModule {}

