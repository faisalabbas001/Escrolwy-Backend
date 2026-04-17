import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
} from "class-validator";

/**
 * Create Email Template DTO
 */
export class CreateTemplateDto {
  @ApiProperty({
    description: "Template identifier used in Resend (e.g., 'escrow_created_v1', 'inquiry_message_sent_v1')",
    example: "escrow_created_v1",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  templateId!: string;

  @ApiProperty({
    description: "Human-readable template name",
    example: "Inquiry Message Sent",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    description: "Template description",
    example: "Email sent when a new message is added to an inquiry",
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: "Handlebars subject template with variables (e.g., {{variableName}})",
    example: "New escrow created: {{escrowId}}",
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({
    description: "Handlebars HTML template with variables (e.g., {{variableName}})",
    example: "<h1>New Escrow Created</h1><p>Your escrow <strong>{{escrowId}}</strong> has been created.</p><p><strong>Amount:</strong> {{amount}} {{asset}}</p><p><a href=\"{{escrowUrl}}\">View Escrow</a></p>",
  })
  @IsString()
  @IsNotEmpty()
  html!: string;

  @ApiPropertyOptional({
    description: "JSON array string of required template variables used in the template",
    example: '["escrowId", "amount", "asset", "escrowUrl"]',
  })
  @IsString()
  @IsOptional()
  variables?: string;

  @ApiPropertyOptional({
    description: "Template version",
    example: "v1",
    default: "v1",
  })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({
    description: "Whether template is active",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Update Email Template DTO
 */
export class UpdateTemplateDto {
  @ApiPropertyOptional({
    description: "Human-readable template name",
    example: "Inquiry Message Sent",
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: "Template description",
    example: "Email sent when a new message is added to an inquiry",
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: "Handlebars subject template with variables (e.g., {{variableName}})",
    example: "New escrow created: {{escrowId}}",
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({
    description: "Handlebars HTML template with variables (e.g., {{variableName}})",
    example: "<h1>New Escrow Created</h1><p>Your escrow <strong>{{escrowId}}</strong> has been created.</p>",
  })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({
    description: "JSON array string of required template variables used in the template",
    example: '["escrowId", "amount", "asset", "escrowUrl"]',
  })
  @IsString()
  @IsOptional()
  variables?: string;

  @ApiPropertyOptional({
    description: "Template version",
    example: "v2",
  })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({
    description: "Whether template is active",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Email Template Response DTO
 */
export class TemplateResponseDto {
  @ApiProperty({
    description: "Template ID (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({
    description: "Template identifier",
    example: "inquiry_message_sent_v1",
  })
  templateId!: string;

  @ApiProperty({
    description: "Human-readable template name",
    example: "Inquiry Message Sent",
  })
  name!: string;

  @ApiPropertyOptional({
    description: "Template description",
    example: "Email sent when a new message is added to an inquiry",
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    description: "Handlebars subject template",
    example: "New message in inquiry {{inquiryId}}",
  })
  subject!: string;

  @ApiProperty({
    description: "Handlebars HTML template",
    example: "<h1>New Message</h1><p>You have a new message in inquiry {{inquiryId}}.</p>",
  })
  html!: string;

  @ApiPropertyOptional({
    description: "JSON array of required template variables",
    example: '["inquiryId", "senderName", "message"]',
    nullable: true,
  })
  variables?: string | null;

  @ApiProperty({
    description: "Whether template is active",
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: "Template version",
    example: "v1",
  })
  version!: string;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt!: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: "Admin user ID who created the template",
    nullable: true,
  })
  createdBy?: string | null;
}

/**
 * Template List Response DTO
 */
export class TemplateListResponseDto {
  @ApiProperty({
    description: "List of templates",
    type: [TemplateResponseDto],
  })
  data!: TemplateResponseDto[];

  @ApiProperty({
    description: "Total number of templates",
    example: 10,
  })
  total!: number;

  @ApiProperty({
    description: "Current page number",
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: "Items per page",
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: "Total number of pages",
    example: 1,
  })
  totalPages!: number;
}

