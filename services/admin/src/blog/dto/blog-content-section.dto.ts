import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Blog Content Section DTO
 * Represents a section within a blog post (e.g., "How Escrowly Ensures Safe Transactions")
 */
export class BlogContentSectionDto {
  @ApiProperty({
    description: 'Section title',
    example: 'How Escrowly Ensures Safe Transactions',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Section description/content',
    example: 'Escrowly offers a reliable and secure platform...',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Section image URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Subsections within this section',
    type: [BlogContentSectionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogContentSectionDto)
  @IsOptional()
  subsections?: BlogContentSectionDto[];
}

