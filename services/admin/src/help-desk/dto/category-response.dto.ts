import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Category ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Category title',
    example: 'Getting Started',
  })
  title: string;

  @ApiProperty({
    description: 'Category slug',
    example: 'getting-started',
  })
  slug: string;

  @ApiProperty({
    description: 'Number of questions in this category',
    example: 5,
  })
  questionCount?: number;

  @ApiProperty({
    description: 'Created timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

