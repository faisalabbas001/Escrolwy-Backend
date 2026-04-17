import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBlogCategorySimpleDto {
  @ApiProperty({
    description: 'Blog category name',
    example: 'Crypto Escrow',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  category: string;
}


