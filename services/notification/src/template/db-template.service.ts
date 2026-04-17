import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import * as Handlebars from "handlebars";
import { PrismaService } from "../prisma";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
} from "../api/dto/template.dto";

/**
 * Database Template Service
 *
 * Manages email template metadata in the database.
 *
 * Responsibilities:
 * - Store template metadata (subject, html, variables, etc.)
 * - Validate Handlebars syntax
 * - Validate required variables
 * - Ensure templateId uniqueness
 *
 * Important:
 * - Templates MUST exist in Resend Dashboard with matching templateId
 * - This service only stores metadata, not the actual template in Resend
 * - When sending emails, Resend will use the templateId to find the template
 *
 * Reference: https://resend.com/docs/dashboard/templates/introduction
 */
@Injectable()
export class DbTemplateService {
  private readonly logger = new Logger(DbTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extract variables from Handlebars template
   */
  private extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(template)) !== null) {
      const varName = match[1].trim();
      // Skip Handlebars helpers and built-ins
      if (
        !varName.startsWith("#") &&
        !varName.startsWith("/") &&
        !varName.startsWith("else") &&
        !varName.startsWith("if") &&
        !varName.startsWith("each") &&
        !varName.startsWith("with") &&
        !varName.includes(".") // Skip nested properties for now
      ) {
        variables.add(varName);
      }
    }

    return Array.from(variables);
  }

  /**
   * Validate Handlebars template syntax
   */
  private validateHandlebars(template: string, templateId: string): void {
    try {
      Handlebars.compile(template);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error";
      throw new BadRequestException(
        `Invalid Handlebars syntax in template ${templateId}: ${errorMsg}`
      );
    }
  }

  /**
   * Validate template variables match declared variables
   */
  private validateVariables(
    subject: string,
    html: string,
    declaredVariables: string[] | null,
    templateId: string
  ): void {
    const subjectVars = this.extractVariables(subject);
    const htmlVars = this.extractVariables(html);
    const allVars = [...new Set([...subjectVars, ...htmlVars])];

    if (declaredVariables && declaredVariables.length > 0) {
      // Check if all declared variables are used
      const unused = declaredVariables.filter((v) => !allVars.includes(v));
      if (unused.length > 0) {
        this.logger.warn(
          `Template ${templateId} declares unused variables: ${unused.join(", ")}`
        );
      }

      // Check if all used variables are declared
      const undeclared = allVars.filter((v) => !declaredVariables.includes(v));
      if (undeclared.length > 0) {
        throw new BadRequestException(
          `Template ${templateId} uses undeclared variables: ${undeclared.join(", ")}. ` +
            `Please add them to the variables array.`
        );
      }
    }
  }

  /**
   * Create a new template (stores metadata in database)
   */
  async create(
    dto: CreateTemplateDto,
    createdBy?: string
  ): Promise<TemplateResponseDto> {
    // Check if templateId already exists
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { templateId: dto.templateId },
    });

    if (existing) {
      throw new ConflictException(
        `Template with templateId '${dto.templateId}' already exists`
      );
    }

    // Validate Handlebars syntax
    this.validateHandlebars(dto.subject, dto.templateId);
    this.validateHandlebars(dto.html, dto.templateId);

    // Parse and validate variables
    let variables: string[] = [];
    if (dto.variables) {
      try {
        variables = JSON.parse(dto.variables);
        if (!Array.isArray(variables)) {
          throw new BadRequestException(
            "variables must be a JSON array of strings"
          );
        }
      } catch (e) {
        if (e instanceof BadRequestException) {
          throw e;
        }
        throw new BadRequestException(
          `Invalid variables JSON: ${dto.variables}`
        );
      }
    }

    // Validate variables match template usage
    this.validateVariables(
      dto.subject,
      dto.html,
      variables.length > 0 ? variables : null,
      dto.templateId
    );

    // Create template in database
    const template = await this.prisma.emailTemplate.create({
      data: {
        templateId: dto.templateId,
        name: dto.name,
        description: dto.description || null,
        subject: dto.subject,
        html: dto.html,
        variables: dto.variables || null,
        version: dto.version || "v1",
        isActive: dto.isActive !== false,
        createdBy: createdBy || null,
      },
    });

    this.logger.log(`Template registered in database: ${dto.templateId}`);

    return this.mapToDto(template);
  }

  /**
   * Update existing template
   */
  async update(
    templateId: string,
    dto: UpdateTemplateDto
  ): Promise<TemplateResponseDto> {
    // Find existing template
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { templateId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Template with templateId '${templateId}' not found`
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description || null;
    }
    if (dto.subject !== undefined) {
      this.validateHandlebars(dto.subject, templateId);
      updateData.subject = dto.subject;
    }
    if (dto.html !== undefined) {
      this.validateHandlebars(dto.html, templateId);
      updateData.html = dto.html;
    }
    if (dto.variables !== undefined) {
      updateData.variables = dto.variables || null;
    }
    if (dto.version !== undefined) {
      updateData.version = dto.version;
    }
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    // Validate variables if subject/html/variables changed
    if (dto.subject || dto.html || dto.variables) {
      const finalSubject = dto.subject || existing.subject;
      const finalHtml = dto.html || existing.html;
      let finalVariables: string[] | null = null;

      if (dto.variables) {
        try {
          finalVariables = JSON.parse(dto.variables);
          if (!Array.isArray(finalVariables)) {
            throw new BadRequestException(
              "variables must be a JSON array of strings"
            );
          }
        } catch (e) {
          if (e instanceof BadRequestException) {
            throw e;
          }
          throw new BadRequestException(`Invalid variables JSON: ${dto.variables}`);
        }
      } else if (existing.variables) {
        try {
          finalVariables = JSON.parse(existing.variables);
        } catch (e) {
          // Ignore parse errors for existing data
        }
      }

      this.validateVariables(
        finalSubject,
        finalHtml,
        finalVariables,
        templateId
      );
    }

    // Update template
    const updated = await this.prisma.emailTemplate.update({
      where: { templateId },
      data: updateData,
    });

    this.logger.log(`Template updated in database: ${templateId}`);

    return this.mapToDto(updated);
  }

  /**
   * Get template by templateId
   */
  async findOne(templateId: string): Promise<TemplateResponseDto> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { templateId },
    });

    if (!template) {
      throw new NotFoundException(
        `Template with templateId '${templateId}' not found`
      );
    }

    return this.mapToDto(template);
  }

  /**
   * List all templates
   */
  async findAll(): Promise<TemplateResponseDto[]> {
    const templates = await this.prisma.emailTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    return templates.map((t: any) => this.mapToDto(t));
  }

  /**
   * Delete template
   */
  async remove(templateId: string): Promise<void> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { templateId },
    });

    if (!template) {
      throw new NotFoundException(
        `Template with templateId '${templateId}' not found`
      );
    }

    await this.prisma.emailTemplate.delete({
      where: { templateId },
    });

    this.logger.log(`Template deleted from database: ${templateId}`);
  }

  /**
   * Map database model to DTO
   */
  private mapToDto(template: any): TemplateResponseDto {
    return {
      id: template.id,
      templateId: template.templateId,
      name: template.name,
      description: template.description,
      subject: template.subject,
      html: template.html,
      variables: template.variables,
      isActive: template.isActive,
      version: template.version,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      createdBy: template.createdBy,
    };
  }
}

