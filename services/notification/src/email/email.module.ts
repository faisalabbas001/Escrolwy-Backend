import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";

/**
 * Email Module
 *
 * Provides EmailService for sending emails via Resend.
 * This module is isolated and contains no business logic.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

