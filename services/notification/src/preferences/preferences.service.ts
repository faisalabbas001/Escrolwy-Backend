import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma";

/**
 * Preferences Service
 *
 * Prevents unwanted emails by checking user preferences.
 *
 * Responsibilities:
 * - Load user preferences
 * - Map event type → preference field
 * - Return allow/deny
 *
 * Rules:
 * - Opt-out model (default: allow)
 * - Denied sends are business failures
 */
@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  // Event type → preference field mapping
  private readonly eventToPreferenceMap: Record<string, keyof UserPreferences> =
    {
      "inquiry.message.added": "emailInquiryMessages",
      "inquiry.resolved": "emailInquiryResolved",
      "escrow.created": "emailEscrowCreated",
      "escrow.completed": "emailEscrowCompleted",
      "escrow.disputed": "emailEscrowDisputed",
      "wallet.deposit.detected": "emailWalletDeposit",
      "wallet.withdrawal.completed": "emailWalletWithdrawal",
      "auth.password.changed": "emailPasswordChanged",
      "auth.email.updated": "emailEmailUpdated",
    };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if user allows email for this event type
   *
   * @param userId - User ID
   * @param eventType - Event type (e.g., "inquiry.message.added")
   * @returns true if allowed, false if denied
   */
  async isAllowed(userId: string, eventType: string): Promise<boolean> {
    try {
      // Get or create user preferences (default: all enabled)
      const preferences = await this.getOrCreatePreferences(userId);

      // Map event type to preference field
      const preferenceField = this.eventToPreferenceMap[eventType];

      if (!preferenceField) {
        // Unknown event type - default to allow
        this.logger.warn(
          `Unknown event type ${eventType}, defaulting to allow`
        );
        return true;
      }

      // Check preference (opt-out model: false = denied)
      const allowed = preferences[preferenceField];

      if (!allowed) {
        this.logger.debug(
          `User ${userId} has opted out of ${eventType} emails`
        );
      }

      return allowed;
    } catch (error) {
      this.logger.error(
        `Failed to check preferences for user ${userId}: ${error}`,
        (error as Error).stack
      );
      // On error, default to allow (fail open)
      return true;
    }
  }

  /**
   * Get user preferences or create default if not exists
   */
  private async getOrCreatePreferences(
    userId: string
  ): Promise<UserPreferences> {
    let preferences = await this.prisma.userNotificationSettings.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences (all enabled)
      preferences = await this.prisma.userNotificationSettings.create({
        data: {
          userId,
          emailInquiryMessages: true,
          emailInquiryResolved: true,
          emailEscrowCreated: true,
          emailEscrowCompleted: true,
          emailEscrowDisputed: true,
          emailWalletDeposit: true,
          emailWalletWithdrawal: true,
          emailPasswordChanged: true,
          emailEmailUpdated: true,
        },
      });
    }

    return {
      emailInquiryMessages: preferences.emailInquiryMessages,
      emailInquiryResolved: preferences.emailInquiryResolved,
      emailEscrowCreated: preferences.emailEscrowCreated,
      emailEscrowCompleted: preferences.emailEscrowCompleted,
      emailEscrowDisputed: preferences.emailEscrowDisputed,
      emailWalletDeposit: preferences.emailWalletDeposit,
      emailWalletWithdrawal: preferences.emailWalletWithdrawal,
      emailPasswordChanged: preferences.emailPasswordChanged,
      emailEmailUpdated: preferences.emailEmailUpdated,
    };
  }
}

/**
 * User preferences interface
 */
interface UserPreferences {
  emailInquiryMessages: boolean;
  emailInquiryResolved: boolean;
  emailEscrowCreated: boolean;
  emailEscrowCompleted: boolean;
  emailEscrowDisputed: boolean;
  emailWalletDeposit: boolean;
  emailWalletWithdrawal: boolean;
  emailPasswordChanged: boolean;
  emailEmailUpdated: boolean;
}

