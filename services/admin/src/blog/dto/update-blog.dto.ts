import { PartialType } from '@nestjs/swagger';
import { CreateBlogDto } from './create-blog.dto';

/**
 * Update Blog DTO
 * All fields are optional for partial updates
 */
export class UpdateBlogDto extends PartialType(CreateBlogDto) {}

