import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlogContentSectionDto } from './blog-content-section.dto';

/**
 * Create Blog DTO
 * Used for creating new blog posts
 */
export class CreateBlogDto {
  @ApiProperty({
    description: 'Blog title',
    example: 'How Escrowly Ensures Safe Transactions',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiProperty({
    description: 'Blog slug (URL-friendly version of title)',
    example: 'how-escrowly-ensures-safe-transactions',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  slug: string;

  @ApiProperty({
    description: 'Blog category name',
    example: 'Crypto Escrow',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Blog featured image URL',
    example: 'https://example.com/blog-image.jpg',
  })
  @IsUrl()
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({
    description: 'Blog excerpt/summary',
    example: 'Learn how Escrowly provides secure crypto transactions...',
  })
  @IsString()
  @IsOptional()
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Estimated read time in minutes',
    example: 4,
    minimum: 1,
    maximum: 60,
    default: 4,
  })
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  readTime?: number;

  @ApiPropertyOptional({
    description: 'Whether the blog is published',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiProperty({
    description: 'Blog content sections (table of contents, sections with title, description, images)',
    type: [BlogContentSectionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogContentSectionDto)
  contentSections: BlogContentSectionDto[];

  @ApiPropertyOptional({
    description: 'ID of the user creating the blog',
  })
  @IsString()
  @IsOptional()
  createdBy?: string;
}

