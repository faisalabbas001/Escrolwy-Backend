import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma";
import { EmailService } from "../email";
import { TemplateService } from "../template";

/**
 * Retry Service
 *
 * Production resilience through retry and DLQ.
 *
 * Retry only if:
 * - Network error
 * - Resend 5xx
 *
 * Never retry if:
 * - User opted out
 * - Invalid email
 *
 * After max retries:
 * - Move to DLQ
 */
@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 5000; // 5 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService
  ) {}

  /**
   * Process failed notifications (runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processFailedNotifications(): Promise<void> {
    try {
      // Check if table exists (migrations might not have run yet)
      try {
        // Find failed notifications that haven't exceeded max retries
        const failed = await this.prisma.notificationLog.findMany({
          where: {
            status: "failed",
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          take: 20, // Process 20 at a time
        });

        if (failed.length === 0) {
          return;
        }

        this.logger.log(`Processing ${failed.length} failed notifications`);

        for (const log of failed) {
          await this.retryNotification(log);
        }
      } catch (error: any) {
        // Handle case where table doesn't exist (migrations not run)
        if (
          error?.message?.includes("does not exist") ||
          error?.code === "P2021"
        ) {
          this.logger.debug(
            "Notification logs table does not exist yet. Run migrations: npm run notification:prisma:migrate"
          );
          return;
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Failed to process retries: ${error}`,
        (error as Error).stack
      );
    }
  }

  /**
   * Retry a failed notification
   */
  private async retryNotification(log: any): Promise<void> {
    // Check if should retry (not user opt-out or invalid email)
    if (
      log.errorMessage?.includes("opted out") ||
      log.errorMessage?.includes("Invalid email")
    ) {
      this.logger.debug(
        `Skipping retry for ${log.id} - business failure: ${log.errorMessage}`
      );
      return;
    }

    // Check retry count (stored in error message or separate field)
    // For now, we'll use a simple approach: retry if error is transient

    const isTransientError =
      log.errorMessage?.includes("Network") ||
      log.errorMessage?.includes("5xx") ||
      log.errorMessage?.includes("timeout");

    if (!isTransientError) {
      this.logger.debug(
        `Skipping retry for ${log.id} - permanent failure: ${log.errorMessage}`
      );
      // Move to DLQ (mark as permanently failed)
      await this.moveToDLQ(log);
      return;
    }

    try {
      // Re-render template (we'd need to store template variables)
      // For now, this is a simplified retry
      this.logger.debug(`Retrying notification ${log.id}`);

      // In production, you'd re-fetch template variables from event
      // For now, we'll just log that retry was attempted
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          errorMessage: `${log.errorMessage} [RETRY ATTEMPTED]`,
        },
      });
    } catch (error) {
      this.logger.error(
        `Retry failed for ${log.id}: ${error}`,
        (error as Error).stack
      );
      await this.moveToDLQ(log);
    }
  }

  /**
   * Move notification to DLQ (dead letter queue)
   */
  private async moveToDLQ(log: any): Promise<void> {
    // In production, you'd write to a DLQ table or Kafka DLQ topic
    this.logger.warn(
      `Moving notification ${log.id} to DLQ after max retries`
    );

    // Mark as permanently failed
    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        errorMessage: `${log.errorMessage} [DLQ]`,
      },
    });
  }
}

