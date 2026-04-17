import { ApiProperty } from '@nestjs/swagger';

/**
 * Blog List Item DTO
 * Used for blog list page - shows title, image, category, and formatted date
 */
export class BlogListItemDto {
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
    description: 'Blog featured image URL',
    example: 'https://example.com/blog-image.jpg',
  })
  imageUrl: string;

  @ApiProperty({
    description: 'Blog category name',
    example: 'Crypto Escrow',
  })
  category: string;

  @ApiProperty({
    description: 'Formatted creation date (e.g., "December 27, 2024")',
    example: 'December 27, 2024',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Formatted publication date (e.g., "December 27, 2024")',
    example: 'December 27, 2024',
  })
  publishedDate: string;

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
}

