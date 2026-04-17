import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBlogCategoryDto {
  @ApiProperty({
    description: 'Blog category name',
    example: 'Updated Category Name',
    maxLength: 255,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  category?: string;
}

