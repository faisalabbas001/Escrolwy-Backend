import { IsString, IsNotEmpty, IsInt, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({
    description: 'Category ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  categoryId: number;

  @ApiProperty({
    description: 'Question text',
    example: 'How does Escrowly work for buyers and sellers?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({
    description: 'Answer text',
    example: 'Escrowly acts as a secure intermediary between buyers and sellers...',
  })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiProperty({
    description: 'Question slug (URL-friendly identifier)',
    example: 'how-does-escrowly-work',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  slug: string;
}

