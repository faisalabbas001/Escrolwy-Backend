import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, IsEnum } from "class-validator";

/**
 * DTO for uploading an attachment
 */
export class CreateAttachmentDto {
  @ApiProperty({
    description: "Message ID this attachment belongs to",
  })
  @IsUUID()
  message_id!: string;

  @ApiProperty({
    description: "S3 URL of the uploaded file",
    example: "https://s3.amazonaws.com/escrowly-files/file.pdf",
  })
  @IsString()
  file_url!: string;

  @ApiProperty({
    description: "File type/extension",
    enum: ["pdf", "image", "document", "spreadsheet", "other"],
  })
  @IsEnum(["pdf", "image", "document", "spreadsheet", "other"])
  file_type!: string;
}

/**
 * Response DTO for attachment
 */
export class AttachmentResponseDto {
  @ApiProperty({
    description: "Unique attachment ID",
  })
  id!: string;

  @ApiProperty({
    description: "Associated inquiry ID",
  })
  inquiry_id!: string;

  @ApiProperty({
    description: "Associated message ID",
  })
  message_id!: string;

  @ApiProperty({
    description: "S3 file URL",
  })
  file_url!: string;

  @ApiProperty({
    description: "File type",
    enum: ["pdf", "image", "document", "spreadsheet", "other"],
  })
  file_type!: string;

  @ApiProperty({
    description: "Creation timestamp",
  })
  created_at!: Date;
}

/**
 * Response DTO for attachment list (paginated)
 */
export class AttachmentListResponseDto {
  @ApiProperty({
    description: "List of attachments",
    type: [AttachmentResponseDto],
  })
  data!: AttachmentResponseDto[];

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
