import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Blog Details Content Section DTO
 * For the details page - shows title, description, and image
 */
export class BlogDetailsContentSectionDto {
  @ApiProperty({
    description: 'Section title',
    example: 'How Escrowly Ensures Safe Transactions',
  })
  title: string;

  @ApiProperty({
    description: 'Section description/content',
    example: 'Escrowly offers a reliable and secure platform...',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Section image URL',
    example: 'https://example.com/section-image.jpg',
  })
  imageUrl?: string;
}

/**
 * Blog Details Response DTO
 * Specifically formatted for the blog details page
 * Structure: Title -> Image -> Array of content sections
 */
export class BlogDetailsResponseDto {
  @ApiProperty({
    description: 'Blog ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Blog title (shown first on details page)',
    example: 'How Escrowly Ensures Safe Transactions',
  })
  title: string;

  @ApiProperty({
    description: 'Blog featured image (shown after title)',
    example: 'https://example.com/blog-image.jpg',
  })
  imageUrl: string;

  @ApiProperty({
    description: 'Blog category name',
    example: 'Crypto Escrow',
  })
  category: string;

  @ApiProperty({
    description: 'Blog slug',
    example: 'how-escrowly-ensures-safe-transactions',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Blog excerpt',
    example: 'Learn how Escrowly provides secure crypto transactions...',
  })
  excerpt?: string;

  @ApiProperty({
    description: 'Estimated read time in minutes',
    example: 4,
  })
  readTime: number;

  @ApiProperty({
    description: 'Publication date (formatted)',
    example: 'December 27, 2024',
  })
  publishedDate: string;

  @ApiProperty({
    description: 'Creation date (formatted)',
    example: 'December 27, 2024',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Whether the blog is published',
    example: true,
  })
  isPublished: boolean;

  @ApiProperty({
    description: 'Content sections array (shown after title and image)',
    type: [BlogDetailsContentSectionDto],
  })
  contentSections: BlogDetailsContentSectionDto[];
}

