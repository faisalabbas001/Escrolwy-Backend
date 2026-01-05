import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, IsEnum } from "class-validator";

/**
 * DTO for adding a message to an inquiry
 */
export class CreateMessageDto {
  @ApiProperty({
    description: "Sender user ID (UUID)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID()
  senderId!: string;

  @ApiProperty({
    description: "Role of the sender",
    enum: ["buyer", "seller", "admin"],
    example: "buyer",
  })
  @IsEnum(["buyer", "seller", "admin"])
  senderRole!: string;

  @ApiProperty({
    description: "Message content",
    example: "I would like to clarify the payment terms",
  })
  @IsString()
  message!: string;
}

/**
 * Response DTO for message
 */
export class MessageResponseDto {
  @ApiProperty({
    description: "Unique message ID",
  })
  id!: string;

  @ApiProperty({
    description: "Associated inquiry ID",
  })
  inquiry_id!: string;

  @ApiProperty({
    description: "Sender user ID",
  })
  sender_id!: string;

  @ApiProperty({
    description: "Sender role",
    enum: ["buyer", "seller", "admin"],
  })
  sender_role!: string;

  @ApiProperty({
    description: "Message content",
    nullable: true,
  })
  message!: string | null;

  @ApiProperty({
    description: "Creation timestamp",
  })
  created_at!: Date;
}

/**
 * Response DTO for message list (paginated)
 */
export class MessageListResponseDto {
  @ApiProperty({
    description: "List of messages",
    type: [MessageResponseDto],
  })
  data!: MessageResponseDto[];

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
