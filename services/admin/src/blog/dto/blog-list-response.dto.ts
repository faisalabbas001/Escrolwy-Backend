import { ApiProperty } from '@nestjs/swagger';
import { BlogListItemDto } from './blog-list-item.dto';

/**
 * Blog List Response DTO
 * Used for paginated blog list responses
 */
export class BlogListResponseDto {
  @ApiProperty({
    description: 'List of blogs',
    type: [BlogListItemDto],
  })
  blogs: BlogListItemDto[];

  @ApiProperty({
    description: 'Total number of blogs',
    example: 37,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 4,
  })
  totalPages: number;
}

