import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { Roles, Role, CurrentUser } from "@escrowly/auth-common";
import { DbTemplateService } from "./db-template.service";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  TemplateListResponseDto,
} from "../api/dto/template.dto";

/**
 * Template Controller
 *
 * Admin-only endpoints for managing email template metadata in the database.
 *
 * Important:
 * - Templates MUST be created in Resend Dashboard first: https://resend.com/templates
 * - This API only stores template metadata (subject, html, variables) in the database
 * - The templateId must match the template ID in Resend Dashboard
 * - Templates use Handlebars syntax for variables (e.g., {{variableName}})
 *
 * Email-only scope (no SMS/push/in-app templates).
 *
 * Reference: https://resend.com/docs/dashboard/templates/introduction
 */
@ApiTags("admin")
@ApiBearerAuth()
@Controller({
  path: "admin/templates",
  version: "1",
})
@Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
export class TemplateController {
  constructor(private readonly dbTemplateService: DbTemplateService) {}

  /**
   * List all registered templates
   * Endpoint: GET /api/v1/admin/templates
   *
   * Returns all email templates registered in the database.
   * Templates must exist in Resend Dashboard with matching templateId.
   */
  @Get()
  @ApiOperation({
    summary: "List all registered email templates",
    description:
      "Returns all email templates registered in the Notification Service database. " +
      "Templates must be created in Resend Dashboard first with matching templateId. " +
      "This endpoint only returns metadata stored in the database, not templates from Resend.",
  })
  @ApiResponse({
    status: 200,
    description: "List of registered templates",
    type: TemplateListResponseDto,
    schema: {
      example: {
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            templateId: "escrow_created_v1",
            name: "Escrow Created",
            description: "Email sent when a new escrow is created",
            subject: "New escrow created: {{escrowId}}",
            html: "<h1>New Escrow Created</h1>",
            variables: '["escrowId", "amount", "asset"]',
            isActive: true,
            version: "v1",
            createdAt: "2025-12-30T08:00:00.000Z",
            updatedAt: "2025-12-30T08:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async findAll(): Promise<TemplateListResponseDto> {
    const templates = await this.dbTemplateService.findAll();

    return {
      data: templates,
      total: templates.length,
      page: 1,
      limit: templates.length || 20,
      totalPages: 1,
    };
  }

  /**
   * Get template by templateId
   * Endpoint: GET /api/v1/admin/templates/:templateId
   *
   * Returns template metadata from the database.
   */
  @Get(":templateId")
  @ApiOperation({
    summary: "Get template by templateId",
    description:
      "Returns email template metadata from the Notification Service database. " +
      "The templateId must match a template created in Resend Dashboard.",
  })
  @ApiParam({
    name: "templateId",
    description: "Template identifier (must match Resend Dashboard template ID)",
    example: "escrow_created_v1",
  })
  @ApiResponse({
    status: 200,
    description: "Template details",
    type: TemplateResponseDto,
    schema: {
      example: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "escrow_created_v1",
        name: "Escrow Created",
        description: "Email sent when a new escrow is created",
        subject: "New escrow created: {{escrowId}}",
        html: "<h1>New Escrow Created</h1><p>Your escrow <strong>{{escrowId}}</strong> has been created.</p>",
        variables: '["escrowId", "amount", "asset", "escrowUrl"]',
        isActive: true,
        version: "v1",
        createdAt: "2025-12-30T08:00:00.000Z",
        updatedAt: "2025-12-30T08:00:00.000Z",
        createdBy: null,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Template not found",
    schema: {
      example: {
        message: "Template with templateId 'escrow_created_v1' not found",
        error: "Not Found",
        statusCode: 404,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async findOne(
    @Param("templateId") templateId: string
  ): Promise<TemplateResponseDto> {
    return await this.dbTemplateService.findOne(templateId);
  }

  /**
   * Register a new template in the database
   * Endpoint: POST /api/v1/admin/templates
   *
   * Registers email template metadata in the Notification Service database.
   * The template MUST already exist in Resend Dashboard with matching templateId.
   * Templates use Handlebars syntax for variables (e.g., {{variableName}}).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register a new email template",
    description:
      "Registers an email template in the Notification Service database. " +
      "**IMPORTANT:** The template MUST already exist in Resend Dashboard with the same templateId. " +
      "Templates use Handlebars syntax for variables (e.g., {{variableName}}). " +
      "\n\n**Workflow:**\n" +
      "1. Create template in Resend Dashboard: https://resend.com/templates\n" +
      "2. Register template metadata via this API endpoint\n" +
      "3. Template is ready for use in email notifications\n" +
      "\n\nThis endpoint validates:\n" +
      "- Handlebars syntax in subject and HTML\n" +
      "- Required variables match template usage\n" +
      "- TemplateId uniqueness",
  })
  @ApiResponse({
    status: 201,
    description: "Template registered successfully",
    type: TemplateResponseDto,
    schema: {
      example: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "escrow_created_v1",
        name: "Escrow Created",
        description: "Email sent when a new escrow is created",
        subject: "New escrow created: {{escrowId}}",
        html: "<h1>New Escrow Created</h1><p>Your escrow <strong>{{escrowId}}</strong> has been created.</p>",
        variables: '["escrowId", "amount", "asset", "escrowUrl"]',
        isActive: true,
        version: "v1",
        createdAt: "2025-12-30T08:00:00.000Z",
        updatedAt: "2025-12-30T08:00:00.000Z",
        createdBy: "admin-user-id",
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid template data, Handlebars syntax error, or variable mismatch",
    schema: {
      example: {
        message: "Template escrow_created_v1 uses undeclared variables: newVar. Please add them to the variables array.",
        error: "Bad Request",
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: "Template with this templateId already exists",
    schema: {
      example: {
        message: "Template with templateId 'escrow_created_v1' already exists",
        error: "Conflict",
        statusCode: 409,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser("id") userId?: string
  ): Promise<TemplateResponseDto> {
    return await this.dbTemplateService.create(dto, userId || undefined);
  }

  /**
   * Update existing template metadata
   * Endpoint: PUT /api/v1/admin/templates/:templateId
   *
   * Updates template metadata in the database. Only provided fields will be updated.
   * Note: To update the actual template in Resend, use Resend Dashboard.
   */
  @Put(":templateId")
  @ApiOperation({
    summary: "Update existing template metadata",
    description:
      "Updates email template metadata in the Notification Service database. " +
      "Only the fields provided in the request body will be updated. " +
      "Templates use Handlebars syntax for variables (e.g., {{variableName}}). " +
      "\n\n**Note:** This only updates metadata in the database. " +
      "To update the actual template in Resend, use Resend Dashboard: https://resend.com/templates",
  })
  @ApiParam({
    name: "templateId",
    description: "Template identifier (must match Resend Dashboard template ID)",
    example: "escrow_created_v1",
  })
  @ApiResponse({
    status: 200,
    description: "Template updated successfully",
    type: TemplateResponseDto,
    schema: {
      example: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "escrow_created_v1",
        name: "Escrow Created",
        description: "Updated description",
        subject: "Updated: New escrow created: {{escrowId}}",
        html: "<h1>Updated Template</h1><p>Your escrow {{escrowId}} has been created.</p>",
        variables: '["escrowId", "amount", "asset"]',
        isActive: true,
        version: "v1",
        createdAt: "2025-12-30T08:00:00.000Z",
        updatedAt: "2025-12-30T09:00:00.000Z",
        createdBy: null,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Template not found",
    schema: {
      example: {
        message: "Template with templateId 'escrow_created_v1' not found",
        error: "Not Found",
        statusCode: 404,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid template data, Handlebars syntax error, or variable mismatch",
    schema: {
      example: {
        message: "Invalid Handlebars syntax in template escrow_created_v1: Parse error on line 1",
        error: "Bad Request",
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async update(
    @Param("templateId") templateId: string,
    @Body() dto: UpdateTemplateDto
  ): Promise<TemplateResponseDto> {
    return await this.dbTemplateService.update(templateId, dto);
  }

  /**
   * Delete template metadata from database
   * Endpoint: DELETE /api/v1/admin/templates/:templateId
   *
   * Permanently deletes template metadata from the database.
   * Note: This does NOT delete the template from Resend Dashboard.
   */
  @Delete(":templateId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete template metadata",
    description:
      "Permanently deletes email template metadata from the Notification Service database. " +
      "This action cannot be undone. " +
      "\n\n**Note:** This only deletes metadata from the database. " +
      "To delete the actual template from Resend, use Resend Dashboard: https://resend.com/templates",
  })
  @ApiParam({
    name: "templateId",
    description: "Template identifier (must match Resend Dashboard template ID)",
    example: "escrow_created_v1",
  })
  @ApiResponse({
    status: 204,
    description: "Template deleted successfully (no content)",
  })
  @ApiResponse({
    status: 404,
    description: "Template not found",
    schema: {
      example: {
        message: "Template with templateId 'escrow_created_v1' not found",
        error: "Not Found",
        statusCode: 404,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Missing or invalid JWT token",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  async remove(@Param("templateId") templateId: string): Promise<void> {
    await this.dbTemplateService.remove(templateId);
  }
}

