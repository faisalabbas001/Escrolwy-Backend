import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsNotEmpty } from "class-validator";

/**
 * Test Email DTO
 *
 * For admin test-send endpoint
 */
export class TestEmailDto {
  @ApiProperty({
    description: "Recipient email address",
    example: "test@example.com",
  })
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @ApiProperty({
    description: "Email subject",
    example: "Test Email from Notification Service",
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({
    description: "Email HTML body",
    example: "<h1>Test Email</h1><p>This is a test email.</p>",
  })
  @IsString()
  @IsNotEmpty()
  html!: string;
}

