import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ValidateNested, ArrayMinSize, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionDto {
  @ApiProperty({ description: 'Question text', example: 'How to reset password?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Answer text', example: 'Go to settings and click reset' })
  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class CreateHelpDeskDto {
  @ApiProperty({ description: 'Help desk item title', example: 'How to reset password?' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Category name', example: 'Food' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'Array of questions and answers',
    type: [QuestionDto],
    example: [
      { question: 'Q1?', answer: 'A1' },
      { question: 'Q2?', answer: 'A2' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions: QuestionDto[];

  @ApiPropertyOptional({
    description: 'Image URL (uploaded to S3)',
    example: 'https://bucket.s3.region.amazonaws.com/help-desk/image.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'YouTube link URL',
    example: 'https://www.youtube.com/watch?v=example',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  youtubeLink?: string;
}

