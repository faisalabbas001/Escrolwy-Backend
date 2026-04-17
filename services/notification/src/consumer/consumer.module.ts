import { Module } from "@nestjs/common";
import { NotificationConsumerService } from "./notification-consumer.service";
import { NotificationsModule } from "../notifications";

/**
 * Consumer Module
 *
 * Kafka event consumer for notifications.
 */
@Module({
  imports: [NotificationsModule],
  providers: [NotificationConsumerService],
})
export class ConsumerModule {}

