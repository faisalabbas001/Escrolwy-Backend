import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, IsEnum, IsOptional } from "class-validator";

/**
 * DTO for creating a new inquiry
 */
export class CreateInquiryDto {
  @ApiProperty({
    description: "Escrow ID for the inquiry",
    example: "escrow-123",
  })
  @IsString()
  escrow_id!: string;

  @ApiProperty({
    description: "User ID (UUID) who created the inquiry",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID()
  created_by!: string;

  @ApiProperty({
    description: "Optional initial message",
    example: "I have a question about this transaction",
    required: false,
  })
  @IsOptional()
  @IsString()
  initial_message?: string;
}

/**
 * DTO for closing an inquiry
 */
export class CloseInquiryDto {
  @ApiProperty({
    description: "Resolution status",
    enum: ["Refund to Buyer", "Release to Seller", "Split Funds"],
  })
  @IsEnum(["Refund to Buyer", "Release to Seller", "Split Funds"])
  status!: string;

  @ApiProperty({
    description: "Optional closing note",
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * Response DTO for inquiry
 */
export class InquiryResponseDto {
  @ApiProperty({
    description: "Unique inquiry ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({
    description: "Associated escrow ID",
    example: "escrow-123",
  })
  escrow_id!: string;

  @ApiProperty({
    description: "User ID who created the inquiry",
  })
  created_by!: string;

  @ApiProperty({
    description: "Assigned admin ID (if any)",
    nullable: true,
  })
  assigned_admin_id!: string | null;

  @ApiProperty({
    description: "Inquiry status",
    enum: ["open", "resolved", "closed"],
  })
  status!: string;

  @ApiProperty({
    description: "Creation timestamp",
  })
  created_at!: Date;

  @ApiProperty({
    description: "Last update timestamp",
  })
  updated_at!: Date;
}

/**
 * Response DTO for inquiry with related data
 */
export class InquiryDetailResponseDto extends InquiryResponseDto {
  @ApiProperty({
    description: "Messages in the inquiry",
    type: Array,
  })
  messages?: any[];

  @ApiProperty({
    description: "Attachments in the inquiry",
    type: Array,
  })
  attachments?: any[];

  @ApiProperty({
    description: "Message count",
  })
  messageCount?: number;

  @ApiProperty({
    description: "Attachment count",
  })
  attachmentCount?: number;
}

/**
 * Response DTO for inquiry list
 */
export class InquiryListResponseDto {
  @ApiProperty({
    description: "List of inquiries",
    type: [InquiryResponseDto],
  })
  data!: InquiryResponseDto[];

  @ApiProperty({
    description: "Total count",
  })
  total!: number;

  @ApiProperty({
    description: "Current page",
  })
  page!: number;

  @ApiProperty({
    description: "Items per page",
  })
  limit!: number;

  @ApiProperty({
    description: "Total pages",
  })
  totalPages!: number;
}
