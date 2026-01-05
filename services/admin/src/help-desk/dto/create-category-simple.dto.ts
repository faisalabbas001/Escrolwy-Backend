import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCategorySimpleDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Food',
  })
  @IsString()
  @IsNotEmpty()
  category: string;
}

