import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';

export class QuestionResponseDto {
  @ApiProperty({
    description: 'Question ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Category ID',
    example: 1,
  })
  categoryId: number;

  @ApiProperty({
    description: 'Question text',
    example: 'How does Escrowly work for buyers and sellers?',
  })
  question: string;

  @ApiProperty({
    description: 'Answer text',
    example: 'Escrowly acts as a secure intermediary...',
  })
  answer: string;

  @ApiProperty({
    description: 'Question slug',
    example: 'how-does-escrowly-work',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Category information',
    type: CategoryResponseDto,
  })
  category?: CategoryResponseDto;

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

