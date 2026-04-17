import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

/**
 * Auth Service Client
 *
 * Handles communication with Auth service for:
 * - Fetching user emails by user IDs
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly authServiceUrl: string;
  private readonly serviceToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.authServiceUrl = this.configService.get<string>(
      "AUTH_SERVICE_URL",
      "http://localhost:3002" // Default to dev server port (3002), Docker uses 3000
    );
    this.serviceToken = this.configService.get<string>(
      "SERVICE_TO_SERVICE_TOKEN",
      ""
    );
  }

  async onModuleInit(): Promise<void> {
    this.logger.log("🔧 Initializing AuthService client");
    this.logger.log(`📍 Auth Service URL: ${this.authServiceUrl}`);
    if (!this.serviceToken) {
      this.logger.error(
        "❌ SERVICE_TO_SERVICE_TOKEN not configured - email fetching will fail"
      );
      this.logger.error(
        "   Please set SERVICE_TO_SERVICE_TOKEN environment variable"
      );
    } else {
      this.logger.log(
        `✅ SERVICE_TO_SERVICE_TOKEN configured (length: ${this.serviceToken.length})`
      );
    }
  }


  /**
   * Get emails by user IDs
   * Returns a mapping of user ID to email
   */
  async getEmailsByUserIds(
    userIds: string[]
  ): Promise<Record<string, string>> {
    if (userIds.length === 0) {
      this.logger.debug("📧 No user IDs provided, returning empty email map");
      return {};
    }

    this.logger.log(
      `📧 Fetching emails for ${userIds.length} user ID(s) from auth service`
    );
    this.logger.debug(`   User IDs: ${userIds.join(", ")}`);

    try {
      if (!this.serviceToken) {
        this.logger.error("❌ SERVICE_TO_SERVICE_TOKEN is not set!");
        throw new Error("SERVICE_TO_SERVICE_TOKEN is not configured");
      }

      // Fetch emails directly using SERVICE_TO_SERVICE_TOKEN
      this.logger.debug(
        `   Calling auth service API: ${this.authServiceUrl}/api/v1/internal/auth/users/emails`
      );
      this.logger.debug(
        `   Using SERVICE_TO_SERVICE_TOKEN (length: ${this.serviceToken.length})`
      );

      const response = await firstValueFrom(
        this.httpService.post<{ emails: Record<string, string> }>(
          `${this.authServiceUrl}/api/v1/internal/auth/users/emails`,
          { user_ids: userIds },
          {
            headers: {
              "Content-Type": "application/json",
              "x-service-token": this.serviceToken,
            },
          }
        )
      );

      const emailsFound = Object.keys(response.data.emails).length;
      const emailsNotFound = userIds.length - emailsFound;

      this.logger.log(
        `✅ Successfully fetched emails: ${emailsFound} found, ${emailsNotFound} not found`
      );

      if (emailsFound > 0) {
        this.logger.debug("   Found emails:");
        Object.entries(response.data.emails).forEach(([userId, email]) => {
          this.logger.debug(`     ${userId} → ${email}`);
        });
      }

      if (emailsNotFound > 0) {
        const foundIds = Object.keys(response.data.emails);
        const notFoundIds = userIds.filter((id) => !foundIds.includes(id));
        this.logger.warn(
          `⚠️  Emails not found for ${emailsNotFound} user ID(s): ${notFoundIds.join(", ")}`
        );
      }

      return response.data.emails;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to fetch emails from ${this.authServiceUrl}`
      );
      this.logger.error(
        `   Error: ${error?.response?.data?.message || error.message}`
      );
      if (error?.response?.status) {
        this.logger.error(`   HTTP Status: ${error.response.status}`);
      }
      if (error?.response?.data) {
        this.logger.error(`   Response: ${JSON.stringify(error.response.data)}`);
      }
      this.logger.error(`   User IDs requested: ${userIds.join(", ")}`);
      throw new Error(
        `Failed to fetch emails from auth service: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Get a single email by user ID
   * Convenience method for single user lookups
   */
  async getEmailByUserId(userId: string): Promise<string | null> {
    this.logger.debug(`📧 Fetching email for single user: ${userId}`);
    const emails = await this.getEmailsByUserIds([userId]);
    const email = emails[userId] || null;
    if (email) {
      this.logger.debug(`   ✅ Found email: ${email}`);
    } else {
      this.logger.warn(`   ⚠️  Email not found for user: ${userId}`);
    }
    return email;
  }
}

