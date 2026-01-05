import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryInfoDto {
  @ApiProperty({ example: 'Food' })
  name: string;
}

export class HelpDeskQuestionDto {
  @ApiProperty({ example: 'How to reset password?' })
  question: string;

  @ApiProperty({ example: 'Go to settings and click reset' })
  answer: string;
}

export class HelpDeskItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'How to reset password?' })
  title: string;

  @ApiProperty({ example: 'how-to-reset-password' })
  slug: string;

  @ApiProperty({ type: CategoryInfoDto })
  category: CategoryInfoDto;

  @ApiProperty({ type: [HelpDeskQuestionDto] })
  questions: HelpDeskQuestionDto[];

  @ApiPropertyOptional({
    description: 'Image URL (uploaded to S3)',
    example: 'https://bucket.s3.region.amazonaws.com/help-desk/image.jpg',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'YouTube link URL',
    example: 'https://www.youtube.com/watch?v=example',
  })
  youtubeLink?: string;

  @ApiProperty()
  createdAt: Date;
}

