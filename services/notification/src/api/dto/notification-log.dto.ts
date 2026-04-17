import { ApiProperty } from "@nestjs/swagger";

/**
 * Notification Log Response DTO
 */
export class NotificationLogResponseDto {
  @ApiProperty({
    description: "Notification log ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({
    description: "User ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  userId!: string;

  @ApiProperty({
    description: "Event type that triggered the notification",
    example: "inquiry.message.added",
  })
  eventType!: string;

  @ApiProperty({
    description: "Event key (for idempotency)",
    example: "event-123",
    required: false,
    nullable: true,
  })
  eventKey?: string | null;

  @ApiProperty({
    description: "Email template ID used",
    example: "inquiry_message_sent_v1",
  })
  templateId!: string;

  @ApiProperty({
    description: "Recipient email address",
    example: "user@example.com",
  })
  recipientEmail!: string;

  @ApiProperty({
    description: "Email subject",
    example: "New message in inquiry...",
  })
  subject!: string;

  @ApiProperty({
    description: "Delivery status",
    enum: ["sent", "failed", "skipped"],
    example: "sent",
  })
  status!: string;

  @ApiProperty({
    description: "Error message (if failed)",
    example: "Network timeout",
    required: false,
    nullable: true,
  })
  errorMessage?: string | null;

  @ApiProperty({
    description: "Resend API email ID",
    example: "re_abc123",
    required: false,
    nullable: true,
  })
  resendId?: string | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt!: Date;
}

/**
 * Notification Log List Response DTO
 */
export class NotificationLogListResponseDto {
  @ApiProperty({
    description: "List of notification logs",
    type: [NotificationLogResponseDto],
  })
  data!: NotificationLogResponseDto[];

  @ApiProperty({
    description: "Total number of logs",
    example: 100,
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
    example: 5,
  })
  totalPages!: number;
}

