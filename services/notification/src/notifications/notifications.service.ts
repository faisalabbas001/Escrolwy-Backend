import { Injectable, Logger } from "@nestjs/common";
import {
  BaseEvent,
  NotificationSentPayload,
  NotificationDeliveryFailedPayload,
} from "@escrowly/kafka-core";
import { PrismaService } from "../prisma";
import { EmailService } from "../email";
import { TemplateService } from "../template";
import { PreferencesService } from "../preferences";
import { ProcessedEventsService } from "../processed-events";
import { NotificationMapper, EmailIntent } from "../mapper";
import { NotificationEventProducer } from "../kafka";
import { AuthService } from "../auth";

/**
 * Notifications Service
 *
 * Single source of truth for sending logic.
 *
 * Execution order (MANDATORY):
 * 1. Check idempotency
 * 2. Check preferences
 * 3. Render template
 * 4. Send email
 * 5. Insert notification_logs
 * 6. Mark event processed
 * 7. Emit outbox event (future)
 *
 * Rules:
 * - Partial success is not allowed
 * - Logging happens regardless of outcome
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly preferencesService: PreferencesService,
    private readonly processedEventsService: ProcessedEventsService,
    private readonly eventProducer: NotificationEventProducer,
    private readonly authService: AuthService
  ) {}

  /**
   * Process Kafka event and send notifications
   *
   * @param event - Kafka event
   */
  async processEvent(event: BaseEvent<any>): Promise<void> {
    const eventKey = event.metadata.eventId;
    const eventType = event.metadata.eventType;

    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
    this.logger.log(`📨 Processing event: ${eventKey} (type: ${eventType})`);
    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );

    try {
      // STEP 1: Check idempotency
      this.logger.log(`[STEP 1] Checking idempotency for event ${eventKey}...`);
      const isProcessed = await this.processedEventsService.isProcessed(
        eventKey
      );
      if (isProcessed) {
        this.logger.log(`   ✅ Event ${eventKey} already processed, skipping`);
        return;
      }
      this.logger.log(`   ✅ Event ${eventKey} is new, proceeding`);

      // STEP 2: Map event to email intents
      this.logger.log(`[STEP 2] Mapping event to email intents...`);
      let intents = NotificationMapper.mapEventToIntents(event);
      this.logger.log(`   📋 Generated ${intents.length} email intent(s)`);

      if (intents.length === 0) {
        this.logger.log(
          `   ℹ️  No email intents for event ${eventKey}, marking as processed`
        );
        await this.processedEventsService.markProcessed(eventKey, eventType);
        return;
      }

      // STEP 2.1: Validate intents have valid userIds
      const invalidIntents = intents.filter(
        (intent) => !intent.userId || intent.userId === ""
      );
      if (invalidIntents.length > 0) {
        this.logger.warn(
          `   ⚠️  Found ${invalidIntents.length} intent(s) with missing userIds for event ${eventKey}`
        );
        this.logger.warn(
          `   Invalid intents: ${JSON.stringify(
            invalidIntents.map((i) => ({ templateId: i.templateId }))
          )}`
        );
        // Filter out invalid intents
        intents = intents.filter(
          (intent) => intent.userId && intent.userId !== ""
        );

        if (intents.length === 0) {
          this.logger.error(
            `   ❌ No valid intents for event ${eventKey}, marking as processed`
          );
          await this.processedEventsService.markProcessed(eventKey, eventType);
          return;
        }

        this.logger.log(
          `   ✅ Filtered to ${intents.length} valid intent(s) (removed ${invalidIntents.length} invalid)`
        );
      }

      // Log intent details
      intents.forEach((intent, index) => {
        this.logger.debug(
          `   Intent ${index + 1}: userId=${intent.userId}, templateId=${intent.templateId}`
        );
      });

      // STEP 2.5: Batch fetch emails for all users
      this.logger.log(`[STEP 2.5] Batch fetching emails for all users...`);
      const userIds = intents
        .map((intent) => intent.userId)
        .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates

      this.logger.log(
        `   📧 Fetching emails for ${userIds.length} unique user(s) (${intents.length} total intent(s))`
      );

      let emailsMap: Record<string, string> = {};
      try {
        emailsMap = await this.authService.getEmailsByUserIds(userIds);
        const emailsFound = Object.keys(emailsMap).length;
        this.logger.log(
          `   ✅ Email fetch complete: ${emailsFound}/${userIds.length} emails found`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        this.logger.error(
          `   ❌ Failed to fetch emails for event ${eventKey}: ${errorMsg}`
        );
        this.logger.error(`   Stack: ${(error as Error).stack}`);

        // Log failed notifications for all intents
        this.logger.log(
          `   📝 Logging failed notifications for ${intents.length} intent(s)...`
        );
        await Promise.all(
          intents.map((intent) =>
            this.logNotification({
              userId: intent.userId,
              eventType,
              eventKey,
              templateId: intent.templateId,
              recipientEmail: "",
              subject: "",
              status: "failed",
              errorMessage: `Failed to fetch email: ${errorMsg}`,
            })
          )
        );

        // Emit notification.delivery.failed events
        this.logger.log(
          `   📤 Emitting notification.delivery.failed events for ${intents.length} intent(s)...`
        );
        await Promise.all(
          intents.map(async (intent) => {
            const failedPayload: NotificationDeliveryFailedPayload = {
              notificationId: "",
              userId: intent.userId,
              eventType,
              eventKey,
              templateId: intent.templateId,
              recipientEmail: "",
              subject: "",
              errorMessage: `Failed to fetch email: ${errorMsg}`,
              failedAt: new Date().toISOString(),
              retryCount: 0,
            };
            await this.eventProducer.notificationDeliveryFailed(failedPayload);
          })
        );
        this.logger.error(`   ❌ Event processing failed at email fetch step`);
        throw error;
      }

      // STEP 3: Process each intent with pre-fetched emails
      this.logger.log(
        `[STEP 3] Processing ${intents.length} email intent(s) with pre-fetched emails...`
      );
      const results = await Promise.allSettled(
        intents.map((intent, index) => {
          this.logger.log(
            `   Processing intent ${index + 1}/${intents.length}: userId=${intent.userId}, templateId=${intent.templateId}`
          );
          return this.processEmailIntent(intent, eventKey, eventType, emailsMap);
        })
      );

      // Check if all succeeded
      const failures = results.filter((r) => r.status === "rejected");
      const successes = results.filter((r) => r.status === "fulfilled");

      this.logger.log(
        `   📊 Results: ${successes.length} succeeded, ${failures.length} failed`
      );

      if (failures.length > 0) {
        failures.forEach((failure, index) => {
          if (failure.status === "rejected") {
            this.logger.error(
              `   ❌ Intent ${index + 1} failed: ${failure.reason}`
            );
          }
        });
        const errors = failures
          .map((f) => (f.status === "rejected" ? f.reason : ""))
          .join("; ");
        throw new Error(`Failed to process some emails: ${errors}`);
      }

      // STEP 4: Mark event as processed (only after all emails sent)
      this.logger.log(`[STEP 4] Marking event ${eventKey} as processed...`);
      await this.processedEventsService.markProcessed(eventKey, eventType);
      this.logger.log(`   ✅ Event marked as processed`);

      this.logger.log(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
      this.logger.log(
        `✅ Successfully processed event ${eventKey}: sent ${intents.length} email(s)`
      );
      this.logger.log(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
    } catch (error) {
      this.logger.error(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
      this.logger.error(
        `❌ Failed to process event ${eventKey}: ${error}`
      );
      this.logger.error(`   Stack: ${(error as Error).stack}`);
      this.logger.error(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
      // Don't mark as processed on failure - allow retry
      throw error;
    }
  }

  /**
   * Process a single email intent
   */
  private async processEmailIntent(
    intent: EmailIntent,
    eventKey: string,
    eventType: string,
    emailsMap: Record<string, string>
  ): Promise<void> {
    const { userId, templateId, variables } = intent;

    this.logger.debug(`   ┌─ Processing intent for userId=${userId}, templateId=${templateId}`);

    // STEP 2.1: Check preferences
    this.logger.debug(`   │  [2.1] Checking user preferences...`);
    const allowed = await this.preferencesService.isAllowed(userId, eventType);
    if (!allowed) {
      this.logger.log(
        `   │  ⚠️  User ${userId} opted out of ${eventType}, skipping email`
      );

      // Log skipped email
      await this.logNotification({
        userId,
        eventType,
        eventKey,
        templateId,
        recipientEmail: "", // Not available when skipped
        subject: "",
        status: "skipped",
        errorMessage: "User opted out",
      });

      this.logger.debug(`   └─ Intent skipped (user opted out)`);
      return;
    }
    this.logger.debug(`   │  ✅ User preferences allow sending email`);

    // STEP 2.2: Get recipient email
    this.logger.debug(`   │  [2.2] Resolving recipient email...`);
    const recipientEmail =
      variables.recipientEmail || emailsMap[userId] || null;

    if (!recipientEmail) {
      const errorMsg = `Email not found for user ${userId}`;
      this.logger.error(`   │  ❌ ${errorMsg}`);

      const logEntry = await this.logNotification({
        userId,
        eventType,
        eventKey,
        templateId,
        recipientEmail: "",
        subject: "",
        status: "failed",
        errorMessage: errorMsg,
      });

      // Emit notification.delivery.failed event
      if (logEntry) {
        this.logger.debug(`   │  📤 Emitting notification.delivery.failed event...`);
        const failedPayload: NotificationDeliveryFailedPayload = {
          notificationId: logEntry.id,
          userId,
          eventType,
          eventKey,
          templateId,
          recipientEmail: "",
          subject: "",
          errorMessage: errorMsg,
          failedAt: logEntry.createdAt.toISOString(),
          retryCount: 0,
        };
        await this.eventProducer.notificationDeliveryFailed(failedPayload);
      }

      this.logger.debug(`   └─ Intent failed (email not found)`);
      throw new Error(errorMsg);
    }
    this.logger.log(`   │  ✅ Recipient email resolved: ${recipientEmail}`);

    // STEP 2.3: Render template
    this.logger.debug(`   │  [2.3] Rendering template ${templateId}...`);
    let rendered: { subject: string; html: string };
    try {
      rendered = await this.templateService.render(templateId, variables);
      this.logger.log(
        `   │  ✅ Template rendered: subject="${rendered.subject.substring(0, 50)}${rendered.subject.length > 50 ? "..." : ""}"`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `   │  ❌ Failed to render template ${templateId}: ${errorMsg}`
      );

      await this.logNotification({
        userId,
        eventType,
        eventKey,
        templateId,
        recipientEmail: "", // Not available
        subject: "",
        status: "failed",
        errorMessage: `Template rendering failed: ${errorMsg}`,
      });

      this.logger.debug(`   └─ Intent failed (template rendering)`);
      throw error;
    }

    // STEP 2.4: Send email
    this.logger.debug(`   │  [2.4] Sending email to ${recipientEmail}...`);
    let resendId: string | null = null;
    try {
      resendId = await this.emailService.sendEmail(
        recipientEmail,
        rendered.subject,
        rendered.html
      );
      this.logger.log(
        `   │  ✅ Email sent successfully: resendId=${resendId}`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `   │  ❌ Failed to send email to ${recipientEmail}: ${errorMsg}`
      );

      const logEntry = await this.logNotification({
        userId,
        eventType,
        eventKey,
        templateId,
        recipientEmail,
        subject: rendered.subject,
        status: "failed",
        errorMessage: errorMsg,
      });

      // Emit notification.delivery.failed event via outbox
      if (logEntry) {
        this.logger.debug(`   │  📤 Emitting notification.delivery.failed event...`);
        const failedPayload: NotificationDeliveryFailedPayload = {
          notificationId: logEntry.id,
          userId,
          eventType,
          eventKey,
          templateId,
          recipientEmail,
          subject: rendered.subject,
          errorMessage: errorMsg,
          failedAt: logEntry.createdAt.toISOString(),
          retryCount: 0,
        };
        await this.eventProducer.notificationDeliveryFailed(failedPayload);
      }

      this.logger.debug(`   └─ Intent failed (email sending)`);
      throw error;
    }

    // STEP 2.5: Log successful notification
    this.logger.debug(`   │  [2.5] Logging notification to database...`);
    const logEntry = await this.logNotification({
      userId,
      eventType,
      eventKey,
      templateId,
      recipientEmail,
      subject: rendered.subject,
      status: "sent",
      resendId,
    });
    this.logger.debug(`   │  ✅ Notification logged: logId=${logEntry?.id || "N/A"}`);

    // STEP 2.6: Emit notification.sent event via outbox
    if (logEntry) {
      this.logger.debug(`   │  [2.6] Emitting notification.sent event...`);
      const sentPayload: NotificationSentPayload = {
        notificationId: logEntry.id,
        userId,
        eventType,
        eventKey,
        templateId,
        recipientEmail,
        subject: rendered.subject,
        resendId: resendId!,
        sentAt: logEntry.createdAt.toISOString(),
      };
      await this.eventProducer.notificationSent(sentPayload);
      this.logger.debug(`   │  ✅ Event emitted`);
    }

    this.logger.log(
      `   └─ ✅ Intent completed successfully: userId=${userId}, email=${recipientEmail}, resendId=${resendId}`
    );
  }

  /**
   * Log notification attempt (append-only)
   * Returns the created log entry for event publishing
   */
  private async logNotification(data: {
    userId: string;
    eventType: string;
    eventKey: string;
    templateId: string;
    recipientEmail: string;
    subject: string;
    status: "sent" | "failed" | "skipped";
    errorMessage?: string;
    resendId?: string | null;
  }): Promise<any | null> {
    try {
      const logEntry = await this.prisma.notificationLog.create({
        data: {
          userId: data.userId,
          eventType: data.eventType,
          eventKey: data.eventKey,
          templateId: data.templateId,
          recipientEmail: data.recipientEmail,
          subject: data.subject,
          status: data.status,
          errorMessage: data.errorMessage,
          resendId: data.resendId,
        },
      });
      return logEntry;
    } catch (error) {
      // Log error but don't fail the operation
      this.logger.error(
        `Failed to log notification: ${error}`,
        (error as Error).stack
      );
      return null;
    }
  }

  /**
   * Retry a failed notification
   *
   * @param logId - Notification log ID to retry
   * @returns Resend ID if successful
   */
  async retryFailedNotification(logId: string): Promise<string> {
    this.logger.log(`Retrying failed notification ${logId}`);

    // Find the failed notification log
    const log = await this.prisma.notificationLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      throw new Error(`Notification log ${logId} not found`);
    }

    if (log.status !== "failed") {
      throw new Error(
        `Notification ${logId} is not in failed status (current: ${log.status})`
      );
    }

    // Check if user opted out (don't retry business failures)
    if (log.errorMessage?.includes("opted out")) {
      throw new Error(
        `Cannot retry notification ${logId}: user opted out (business failure)`
      );
    }

    // Re-send the email
    let resendId: string | null = null;
    try {
      resendId = await this.emailService.sendEmail(
        log.recipientEmail,
        log.subject,
        // Note: We don't store the HTML body, so we'd need to re-render
        // For now, we'll use a simple retry that re-sends with the same subject
        // In production, you'd store template variables or re-fetch from event
        `<p>This is a retry of your notification: ${log.subject}</p>`
      );

      // Update log with success
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: {
          status: "sent",
          resendId,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Successfully retried notification ${logId}, new resend ID: ${resendId}`
      );

      return resendId;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Retry failed for notification ${logId}: ${errorMsg}`,
        (error as Error).stack
      );

      // Update log with new error
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: {
          errorMessage: `Retry failed: ${errorMsg}`,
        },
      });

      throw error;
    }
  }
}

