import { ApiProperty } from '@nestjs/swagger';

export class BlogCategoryResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Crypto Escrow' })
  name: string;

  @ApiProperty({ example: 'crypto-escrow' })
  slug: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}


