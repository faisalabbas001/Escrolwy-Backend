import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
} from "../api/dto/template.dto";

/**
 * Resend Template Service
 *
 * ATTENTION: Resend does NOT currently expose template CRUD operations via their REST API.
 * Templates must be created and managed via the Resend Dashboard: https://resend.com/templates
 *
 * This service attempts to call Resend's API but will receive 405 (Method Not Allowed) errors.
 * The endpoints are provided for future compatibility when Resend adds template API support.
 *
 * Current behavior:
 * - All CRUD operations will fail with 405 errors
 * - Error messages direct users to Resend Dashboard
 * - Service gracefully handles these errors
 *
 * Reference: https://resend.com/docs/dashboard/templates/introduction
 */
@Injectable()
export class ResendTemplateService {
  private readonly logger = new Logger(ResendTemplateService.name);
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.resend.com";
  private readonly apiVersion = "v1";

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY");
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Make HTTP request to Resend API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}/${this.apiVersion}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(`Making ${method} request to ${url}`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.message || `HTTP ${response.status}: ${response.statusText}`;

        this.logger.error(
          `Resend API error (${response.status}): ${errorMessage}`,
          JSON.stringify(errorData, null, 2)
        );

        if (response.status === 404) {
          throw new NotFoundException(`Template not found: ${errorMessage}`);
        }

        if (response.status === 405) {
          // Method Not Allowed - Resend doesn't expose template CRUD via REST API
          throw new BadRequestException(
            `Resend API does not support template management via REST API. ` +
            `Please create/manage templates via Resend Dashboard: https://resend.com/templates. ` +
            `Error: ${errorMessage}`
          );
        }

        if (response.status === 400 || response.status === 422) {
          throw new BadRequestException(`Invalid request: ${errorMessage}`);
        }

        throw new InternalServerErrorException(
          `Resend API error: ${errorMessage}`
        );
      }

      // Handle 204 No Content (for DELETE)
      if (response.status === 204) {
        return undefined as T;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const errorMsg =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to call Resend API: ${errorMsg}`, error);
      throw new InternalServerErrorException(
        `Failed to communicate with Resend API: ${errorMsg}`
      );
    }
  }

  /**
   * Map Resend API response to our DTO format
   */
  private mapResendTemplateToDto(resendTemplate: any): TemplateResponseDto {
    return {
      id: resendTemplate.id,
      templateId: resendTemplate.name || resendTemplate.id, // Resend uses 'name' as identifier
      name: resendTemplate.name || "",
      description: resendTemplate.description || null,
      subject: resendTemplate.subject || "",
      html: resendTemplate.html || "",
      variables: resendTemplate.variables
        ? JSON.stringify(resendTemplate.variables)
        : null,
      isActive: resendTemplate.active !== false, // Default to true if not specified
      version: resendTemplate.version || "v1",
      createdAt: resendTemplate.created_at
        ? new Date(resendTemplate.created_at)
        : new Date(),
      updatedAt: resendTemplate.updated_at
        ? new Date(resendTemplate.updated_at)
        : new Date(),
      createdBy: resendTemplate.created_by || null,
    };
  }

  /**
   * List all templates from Resend
   * GET /templates
   *
   * NOTE: Resend does not expose this endpoint. Returns empty array.
   * Use Resend Dashboard to view templates: https://resend.com/templates
   */
  async findAll(): Promise<TemplateResponseDto[]> {
    try {
      const response = await this.makeRequest<{
        data: any[];
      }>("GET", "/templates");

      if (!response.data || !Array.isArray(response.data)) {
        this.logger.warn("Resend API returned unexpected format");
        return [];
      }

      return response.data.map((template) =>
        this.mapResendTemplateToDto(template)
      );
    } catch (error) {
      // Resend doesn't support template listing via API
      this.logger.warn(
        `Template listing not available via Resend API. ` +
        `Use Resend Dashboard: https://resend.com/templates. ` +
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      // Return empty array on error (graceful degradation)
      return [];
    }
  }

  /**
   * Get template by ID from Resend
   * GET /templates/{id}
   */
  async findOne(id: string): Promise<TemplateResponseDto> {
    try {
      const response = await this.makeRequest<any>("GET", `/templates/${id}`);
      return this.mapResendTemplateToDto(response);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get template ${id}: ${error}`);
      throw new NotFoundException(`Template not found: ${id}`);
    }
  }

  /**
   * Create a new template in Resend
   * POST /templates
   *
   * NOTE: Resend does NOT support template creation via REST API.
   * This will return a 405 (Method Not Allowed) error.
   * Templates must be created via Resend Dashboard: https://resend.com/templates
   *
   * This method is provided for future compatibility when Resend adds API support.
   */
  async create(dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    try {
      // Parse variables if provided as JSON string
      let variables: string[] = [];
      if (dto.variables) {
        try {
          variables = JSON.parse(dto.variables);
        } catch (e) {
          this.logger.warn(
            `Invalid variables JSON in template creation: ${dto.variables}`
          );
        }
      }

      // Prepare request body for Resend API
      const requestBody: any = {
        name: dto.templateId, // Resend uses 'name' as the template identifier
        subject: dto.subject,
        html: dto.html,
      };

      // Optional fields
      if (dto.description) {
        requestBody.description = dto.description;
      }

      // Resend may support variables in the future, but for now we store them in description
      if (variables.length > 0) {
        requestBody.description = `${dto.description || ""}\n\nRequired variables: ${variables.join(", ")}`.trim();
      }

      this.logger.log(`Creating template in Resend: ${dto.templateId}`);

      const response = await this.makeRequest<any>(
        "POST",
        "/templates",
        requestBody
      );

      this.logger.log(`Template created successfully: ${response.id}`);

      return this.mapResendTemplateToDto(response);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`Failed to create template: ${error}`);
      throw new BadRequestException(
        `Failed to create template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Update template in Resend
   * PATCH /templates/{id}
   *
   * NOTE: Resend does NOT support template updates via REST API.
   * This will return a 405 (Method Not Allowed) error.
   * Templates must be updated via Resend Dashboard: https://resend.com/templates
   *
   * This method is provided for future compatibility when Resend adds API support.
   */
  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    try {
      const requestBody: any = {};

      // Only include fields that are provided
      if (dto.name !== undefined) {
        requestBody.name = dto.name;
      }
      if (dto.subject !== undefined) {
        requestBody.subject = dto.subject;
      }
      if (dto.html !== undefined) {
        requestBody.html = dto.html;
      }
      if (dto.description !== undefined) {
        requestBody.description = dto.description;
      }

      // Parse variables if provided
      if (dto.variables) {
        try {
          const variables = JSON.parse(dto.variables);
          if (variables.length > 0) {
            requestBody.description = `${dto.description || ""}\n\nRequired variables: ${variables.join(", ")}`.trim();
          }
        } catch (e) {
          // Ignore invalid JSON
        }
      }

      if (Object.keys(requestBody).length === 0) {
        throw new BadRequestException("No fields to update");
      }

      this.logger.log(`Updating template in Resend: ${id}`);

      const response = await this.makeRequest<any>(
        "PATCH",
        `/templates/${id}`,
        requestBody
      );

      this.logger.log(`Template updated successfully: ${id}`);

      return this.mapResendTemplateToDto(response);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`Failed to update template ${id}: ${error}`);
      throw new BadRequestException(
        `Failed to update template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Delete template from Resend
   * DELETE /templates/{id}
   *
   * NOTE: Resend does NOT support template deletion via REST API.
   * This will return a 405 (Method Not Allowed) error.
   * Templates must be deleted via Resend Dashboard: https://resend.com/templates
   *
   * This method is provided for future compatibility when Resend adds API support.
   */
  async remove(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting template from Resend: ${id}`);

      await this.makeRequest<void>("DELETE", `/templates/${id}`);

      this.logger.log(`Template deleted successfully: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete template ${id}: ${error}`);
      throw new BadRequestException(
        `Failed to delete template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
