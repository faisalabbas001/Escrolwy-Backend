import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID, IsEnum } from "class-validator";

/**
 * DTO for admin operations
 */
export class AssignInquiryDto {
  @ApiProperty({
    description: "Admin user ID to assign to",
  })
  @IsUUID()
  admin_id!: string;
}

/**
 * DTO for resolving inquiry as admin
 */
export class ResolveInquiryDto {
  @ApiProperty({
    description: "Resolution status",
    enum: ["Refund to Buyer", "Release to Seller", "Split Funds"],
  })
  @IsEnum(["Refund to Buyer", "Release to Seller", "Split Funds"])
  status!: string;

  @ApiProperty({
    description: "Admin resolution note",
  })
  @IsString()
  resolution_note!: string;
}

/**
 * Response DTO for admin inquiry detail
 */
export class AdminInquiryDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  escrow_id!: string;

  @ApiProperty()
  created_by!: string;

  @ApiProperty()
  assigned_admin_id!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  message_count!: number;

  @ApiProperty()
  attachment_count!: number;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;

  @ApiProperty({
    description: "Latest messages",
    type: Array,
  })
  latest_messages?: any[];
}

/**
 * Response DTO for admin inquiry list
 */
export class AdminInquiryListResponseDto {
  @ApiProperty({
    type: [AdminInquiryDetailResponseDto],
  })
  data!: AdminInquiryDetailResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
