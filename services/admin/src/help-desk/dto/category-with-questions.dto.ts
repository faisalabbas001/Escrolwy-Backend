import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';
import { QuestionResponseDto } from './question-response.dto';

export class CategoryWithQuestionsDto extends CategoryResponseDto {
  @ApiProperty({
    description: 'List of questions in this category',
    type: [QuestionResponseDto],
  })
  questions: QuestionResponseDto[];
}

