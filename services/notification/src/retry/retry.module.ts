import { Module } from "@nestjs/common";
import { RetryService } from "./retry.service";
import { EmailModule } from "../email";
import { TemplateModule } from "../template";

/**
 * Retry Module
 *
 * Handles retry logic and DLQ for failed notifications.
 */
@Module({
  imports: [EmailModule, TemplateModule],
  providers: [RetryService],
})
export class RetryModule {}

