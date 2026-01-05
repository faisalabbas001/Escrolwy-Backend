import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Email Preferences DTO (nested object)
 *
 * Email-only preferences (no SMS/Push fields)
 */
export class EmailPreferencesDto {
  @ApiProperty({
    description: "Enable email notifications for transaction events (escrow, wallet)",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  transaction_events?: boolean;

  @ApiProperty({
    description: "Enable email notifications for account events (password, email changes)",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  account_events?: boolean;

  @ApiProperty({
    description: "Enable email notifications for milestone events (inquiry resolved)",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  milestone_events?: boolean;

  @ApiProperty({
    description: "Enable marketing emails",
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  marketing_emails?: boolean;
}

/**
 * Update Notification Settings DTO
 *
 * Matches the required format with nested preferences object
 */
export class UpdateNotificationSettingsDto {
  @ApiProperty({
    description: "Email notification preferences",
    type: EmailPreferencesDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => EmailPreferencesDto)
  preferences!: EmailPreferencesDto;
}

/**
 * Notification Settings Response DTO
 *
 * Matches the required format with nested preferences object
 */
export class NotificationSettingsResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  userId!: string;

  @ApiProperty({
    description: "Email notification preferences",
    type: EmailPreferencesDto,
  })
  preferences!: EmailPreferencesDto;
}

