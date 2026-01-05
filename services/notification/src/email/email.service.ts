import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

/**
 * Email Service
 *
 * Isolated, reusable email sender using Resend API.
 *
 * Responsibilities:
 * - Accept { to, subject, html }
 * - Call Resend API
 * - Throw on failure
 *
 * Rules:
 * - No logging here
 * - No retries here
 * - No business logic here
 *
 * This service is pure I/O - it only sends emails.
 */
@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY");
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is required");
    }

    this.resend = new Resend(apiKey);
    this.fromEmail =
      this.configService.get<string>("RESEND_FROM_EMAIL") ||
      "notifications@escrowly.com";
  }

  /**
   * Get the from email address (for debugging)
   */
  getFromEmail(): string {
    return this.fromEmail;
  }

  /**
   * Send an email via Resend
   *
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param html - HTML email body
   * @returns Resend message ID
   * @throws Error if sending fails
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<string> {
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (result.error) {
        // Provide more detailed error information
        const errorMessage = result.error.message || "Unknown error";
        const errorDetails = result.error.name ? ` (${result.error.name})` : "";
        
        throw new Error(
          `Resend API error: ${errorMessage}${errorDetails}. ` +
          `From: ${this.fromEmail}, To: ${to}. ` +
          `Check Resend Dashboard to verify domain and from email are verified.`
        );
      }

      if (!result.data?.id) {
        throw new Error("Resend API returned no message ID");
      }

      return result.data.id;
    } catch (error) {
      // Re-throw with context
      if (error instanceof Error) {
        throw new Error(`Failed to send email to ${to}: ${error.message}`);
      }
      throw new Error(`Failed to send email to ${to}: Unknown error`);
    }
  }

  /**
   * Send an email using a Resend template
   *
   * NOTE: The Resend SDK may not support template_id in emails.send() yet.
   * This method is a placeholder. For now, use TemplateService to render templates
   * and send via sendEmail().
   *
   * @param to - Recipient email address
   * @param templateId - Resend template ID or alias
   * @param templateVariables - Variables to inject into the template
   * @returns Resend message ID
   * @throws Error if sending fails
   */
  async sendEmailWithTemplate(
    to: string,
    templateId: string,
    templateVariables: Record<string, any>
  ): Promise<string> {
    // TODO: Check if Resend SDK supports template_id in emails.send()
    // If not, implement direct HTTP API call to Resend's email API with template_id
    // For now, throw an error indicating this feature needs implementation
    
    throw new Error(
      `Sending emails with template_id is not yet supported in the Resend SDK. ` +
      `Please use TemplateService.render() and sendEmail() instead. ` +
      `Template ID: ${templateId}`
    );
  }
}

