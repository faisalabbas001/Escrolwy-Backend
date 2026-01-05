import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Handlebars from "handlebars";
import Redis from "ioredis";
import { PrismaService } from "../prisma";

/**
 * Template Service
 *
 * Deterministic email rendering using Handlebars.
 *
 * Responsibilities:
 * - Fetch template by ID
 * - Compile template
 * - Inject variables
 * - Return { subject, html }
 *
 * Rules:
 * - Missing variables = error
 * - Templates are versioned
 * - Cache compiled templates in Redis
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly redis: Redis;
  private readonly templateCache: Map<string, HandlebarsTemplateDelegate> =
    new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const redisUrl = this.configService.get<string>(
      "REDIS_URL",
      "redis://localhost:6379"
    );
    
    // Parse Redis URL to handle password authentication
    // Format: redis://:password@host:port or redis://host:port
    const redisOptions: any = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
    };

    // If REDIS_URL contains password, ioredis will parse it automatically
    // Otherwise, try to get password from separate env var
    const redisPassword = this.configService.get<string>("REDIS_PASSWORD");
    if (redisPassword) {
      redisOptions.password = redisPassword;
    }

    this.redis = new Redis(redisUrl, redisOptions);

    this.redis.on("connect", () => {
      this.logger.log("✅ Connected to Redis for template caching");
    });

    this.redis.on("error", (err) => {
      // Don't log as error if it's just authentication - it's expected if Redis is not configured
      if (err.message?.includes("NOAUTH")) {
        this.logger.warn(
          "⚠️ Redis authentication failed. Template caching will use in-memory cache only. Set REDIS_URL with password (redis://:password@host:port)"
        );
      } else {
        this.logger.error("❌ Redis connection error:", err);
      }
    });
  }

  /**
   * Render email template
   *
   * @param templateId - Template identifier (e.g., "inquiry_message_sent_v1")
   * @param variables - Template variables
   * @returns Rendered email with subject and HTML
   * @throws Error if template not found or variables missing
   */
  async render(
    templateId: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; html: string }> {
    try {
      // Get template source (subject and body)
      const templateSource = await this.getTemplateSource(templateId);

      // Compile templates (with caching)
      const subjectTemplate = await this.compileTemplate(
        templateId,
        "subject",
        templateSource.subject
      );
      const htmlTemplate = await this.compileTemplate(
        templateId,
        "html",
        templateSource.html
      );

      // Render with variables
      const subject = subjectTemplate(variables);
      const html = htmlTemplate(variables);

      // Validate no missing variables (Handlebars outputs empty for missing vars)
      this.validateRenderedOutput(subject, html, variables);

      return { subject, html };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to render template ${templateId}: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get template source from database
   * Falls back to hardcoded templates if not found in database
   */
  private async getTemplateSource(templateId: string): Promise<{
    subject: string;
    html: string;
  }> {
    try {
      // Try to fetch from database first
      const template = await this.prisma.emailTemplate.findUnique({
        where: { templateId },
      });

      if (template && template.isActive) {
        this.logger.debug(`Loaded template ${templateId} from database`);
        return {
          subject: template.subject,
          html: template.html,
        };
      }
    } catch (error) {
      // Database might not be available or template doesn't exist
      this.logger.debug(
        `Failed to load template ${templateId} from database, falling back to hardcoded: ${error}`
      );
    }

    // Fallback to hardcoded templates (for backward compatibility and initial setup)
    this.logger.debug(`Using hardcoded template ${templateId}`);
    return this.getHardcodedTemplate(templateId);
  }

  /**
   * Get hardcoded template (fallback)
   * These are the default templates that exist before database migration
   */
  private getHardcodedTemplate(templateId: string): {
    subject: string;
    html: string;
  } {
    const templates: Record<string, { subject: string; html: string }> = {
      inquiry_message_sent_v1: {
        subject: "New message in inquiry {{inquiryId}}",
        html: `
          <h1>New Message in Inquiry</h1>
          <p>You have received a new message in inquiry <strong>{{inquiryId}}</strong>.</p>
          <p><strong>From:</strong> {{senderName}}</p>
          <p><strong>Message:</strong> {{message}}</p>
          <p><a href="{{inquiryUrl}}">View Inquiry</a></p>
        `,
      },
      inquiry_message_received_v1: {
        subject: "New message in inquiry {{inquiryId}}",
        html: `
          <h1>New Message in Inquiry</h1>
          <p>You have received a new message in inquiry <strong>{{inquiryId}}</strong>.</p>
          <p><strong>From:</strong> {{senderName}}</p>
          <p><strong>Role:</strong> {{senderRole}}</p>
          <p><strong>Message:</strong> {{message}}</p>
          <p><a href="{{inquiryUrl}}">View Inquiry</a></p>
        `,
      },
      inquiry_resolved_v1: {
        subject: "Inquiry {{inquiryId}} has been resolved",
        html: `
          <h1>Inquiry Resolved</h1>
          <p>Inquiry <strong>{{inquiryId}}</strong> has been resolved.</p>
          <p><strong>Resolution:</strong> {{resolutionType}}</p>
          <p><strong>Note:</strong> {{resolutionNote}}</p>
          <p><a href="{{inquiryUrl}}">View Inquiry</a></p>
        `,
      },
      escrow_completed_v1: {
        subject: "Escrow {{escrowId}} completed successfully",
        html: `
          <h1>Escrow Completed</h1>
          <p>Your escrow <strong>{{escrowId}}</strong> has been completed successfully.</p>
          <p><strong>Amount:</strong> {{amount}} {{asset}}</p>
          <p><strong>Completed at:</strong> {{completedAt}}</p>
          <p><a href="{{escrowUrl}}">View Escrow</a></p>
        `,
      },
      wallet_deposit_v1: {
        subject: "Deposit detected: {{amount}} {{asset}}",
        html: `
          <h1>Deposit Detected</h1>
          <p>Your wallet has received a deposit of <strong>{{amount}} {{asset}}</strong>.</p>
          <p><strong>Transaction:</strong> {{transactionHash}}</p>
          <p><strong>Time:</strong> {{depositedAt}}</p>
          <p><a href="{{walletUrl}}">View Wallet</a></p>
        `,
      },
      escrow_created_v1: {
        subject: "New escrow created: {{escrowId}}",
        html: `
          <h1>New Escrow Created</h1>
          <p>A new escrow <strong>{{escrowId}}</strong> has been created.</p>
          <p><strong>Amount:</strong> {{amount}} {{asset}}</p>
          <p><a href="{{escrowUrl}}">View Escrow</a></p>
        `,
      },
      escrow_disputed_v1: {
        subject: "Dispute filed for escrow {{escrowId}}",
        html: `
          <h1>Dispute Filed</h1>
          <p>A dispute has been filed for escrow <strong>{{escrowId}}</strong>.</p>
          <p><strong>Reason:</strong> {{reason}}</p>
          <p><a href="{{escrowUrl}}">View Escrow</a></p>
        `,
      },
      wallet_withdrawal_v1: {
        subject: "Withdrawal completed: {{amount}} {{asset}}",
        html: `
          <h1>Withdrawal Completed</h1>
          <p>Your withdrawal of <strong>{{amount}} {{asset}}</strong> has been completed.</p>
          <p><strong>Transaction:</strong> {{transactionHash}}</p>
          <p><strong>Time:</strong> {{withdrawnAt}}</p>
          <p><a href="{{walletUrl}}">View Wallet</a></p>
        `,
      },
      password_changed_v1: {
        subject: "Your password has been changed",
        html: `
          <h1>Password Changed</h1>
          <p>Your password was changed at <strong>{{changedAt}}</strong>.</p>
          <p>If you did not make this change, please contact support immediately.</p>
        `,
      },
      email_updated_v1: {
        subject: "Your email address has been updated",
        html: `
          <h1>Email Updated</h1>
          <p>Your email address has been updated to <strong>{{newEmail}}</strong>.</p>
          <p><strong>Changed at:</strong> {{changedAt}}</p>
        `,
      },
    };

    const template = templates[templateId];
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return template;
  }

  /**
   * Compile Handlebars template with Redis caching
   */
  private async compileTemplate(
    templateId: string,
    type: "subject" | "html",
    source: string
  ): Promise<HandlebarsTemplateDelegate> {
    const cacheKey = `template:${templateId}:${type}`;

    // Check in-memory cache first
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    // Check Redis cache (only if Redis is connected)
    try {
      if (this.redis.status === "ready") {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          // Compile from cached source
          const compiled = Handlebars.compile(cached);
          this.templateCache.set(cacheKey, compiled);
          return compiled;
        }
      }
    } catch (error) {
      // Redis not available - fall back to in-memory cache
      // This is expected if Redis is not configured
    }

    // Compile template
    const compiled = Handlebars.compile(source);

    // Cache in memory
    this.templateCache.set(cacheKey, compiled);

    // Cache in Redis (24 hour TTL) - only if Redis is connected
    try {
      if (this.redis.status === "ready") {
        await this.redis.setex(cacheKey, 86400, source);
      }
    } catch (error) {
      // Redis not available - that's okay, we have in-memory cache
      // Don't log as warning to avoid noise
    }

    return compiled;
  }

  /**
   * Validate rendered output for missing variables
   */
  private validateRenderedOutput(
    subject: string,
    html: string,
    variables: Record<string, any>
  ): void {
    // Check for unrendered Handlebars expressions (e.g., {{variable}})
    const handlebarsRegex = /\{\{[^}]+\}\}/g;

    const subjectMatches = subject.match(handlebarsRegex);
    const htmlMatches = html.match(handlebarsRegex);

    if (subjectMatches || htmlMatches) {
      const missing = [
        ...(subjectMatches || []),
        ...(htmlMatches || []),
      ].filter((match) => {
        const varName = match.replace(/[{}]/g, "").trim();
        return !(varName in variables);
      });

      if (missing.length > 0) {
        throw new Error(
          `Missing template variables: ${missing.join(", ")}`
        );
      }
    }
  }
}

