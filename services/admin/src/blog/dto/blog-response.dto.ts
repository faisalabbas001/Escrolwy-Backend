import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlogContentSectionDto } from './blog-content-section.dto';

/**
 * Blog Response DTO
 * Used for API responses
 */
export class BlogResponseDto {
  @ApiProperty({
    description: 'Blog ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Blog title',
    example: 'How Escrowly Ensures Safe Transactions',
  })
  title: string;

  @ApiProperty({
    description: 'Blog slug',
    example: 'how-escrowly-ensures-safe-transactions',
  })
  slug: string;

  @ApiProperty({
    description: 'Blog category name',
    example: 'Crypto Escrow',
  })
  category: string;

  @ApiProperty({
    description: 'Blog featured image URL',
    example: 'https://example.com/blog-image.jpg',
  })
  imageUrl: string;

  @ApiPropertyOptional({
    description: 'Blog excerpt/summary',
    example: 'Learn how Escrowly provides secure crypto transactions...',
  })
  excerpt?: string;

  @ApiProperty({
    description: 'Estimated read time in minutes',
    example: 4,
  })
  readTime: number;

  @ApiProperty({
    description: 'Whether the blog is published',
    example: true,
  })
  isPublished: boolean;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-12-27T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-12-27T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'ID of the user who created the blog',
  })
  createdBy?: string;

  @ApiProperty({
    description: 'Blog content sections',
    type: [BlogContentSectionDto],
  })
  contentSections: BlogContentSectionDto[];
}

