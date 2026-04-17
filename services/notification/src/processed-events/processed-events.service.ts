import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma";

/**
 * Processed Events Service
 *
 * Kafka replay safety through idempotency.
 *
 * Responsibilities:
 * - Check if event_key exists
 * - Mark event_key as processed
 *
 * Rules:
 * - Must be checked before sending email
 * - Must be written only after success
 */
@Injectable()
export class ProcessedEventsService {
  private readonly logger = new Logger(ProcessedEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if event has already been processed
   *
   * @param eventKey - Unique event key (typically metadata.eventId)
   * @returns true if already processed, false if new
   */
  async isProcessed(eventKey: string): Promise<boolean> {
    try {
      const existing = await this.prisma.processedEvent.findUnique({
        where: { eventKey },
      });

      if (existing) {
        this.logger.debug(`Event ${eventKey} already processed`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check if event ${eventKey} is processed: ${error}`,
        (error as Error).stack
      );
      // On error, assume not processed (fail open)
      return false;
    }
  }

  /**
   * Mark event as processed
   *
   * @param eventKey - Unique event key
   * @param eventType - Event type for logging
   * @throws Error if event already exists (should not happen if checked first)
   */
  async markProcessed(eventKey: string, eventType: string): Promise<void> {
    try {
      await this.prisma.processedEvent.create({
        data: {
          eventKey,
          eventType,
        },
      });

      this.logger.debug(`Marked event ${eventKey} as processed`);
    } catch (error: any) {
      // Handle unique constraint violation (event already processed)
      if (error.code === "P2002") {
        this.logger.warn(
          `Event ${eventKey} was already marked as processed (race condition)`
        );
        return;
      }

      this.logger.error(
        `Failed to mark event ${eventKey} as processed: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}

