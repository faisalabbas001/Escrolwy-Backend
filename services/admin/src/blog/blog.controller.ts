import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseEnumPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BlogService } from './blog.service';
import {
  CreateBlogDto,
  UpdateBlogDto,
  BlogResponseDto,
  BlogListResponseDto,
  BlogDetailsResponseDto,
  CreateBlogCategorySimpleDto,
  UpdateBlogCategoryDto,
  BlogCategoryResponseDto,
} from './dto';

/**
 * Blog Controller
 * Handles HTTP requests for blog operations
 */
@ApiTags('blogs')
@ApiBearerAuth('JWT-auth')
@Controller({
  path: 'admin/blogs',
  version: '1',
})
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  /**
   * Create a new blog post (Admin only)
   */
  @Post()
  @ApiOperation({ summary: 'Create a new blog post' })
  @ApiResponse({
    status: 201,
    description: 'Blog created successfully',
    type: BlogResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error or slug already exists',
  })
  async create(@Body() createBlogDto: CreateBlogDto): Promise<BlogResponseDto> {
    return this.blogService.create(createBlogDto);
  }

  /**
   * Get all blogs with optional filtering and pagination
   */
  @Get()
  @ApiOperation({ summary: 'Get all blogs with optional filtering' })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filter by blog category name',
  })
  @ApiQuery({
    name: 'published',
    required: false,
    type: Boolean,
    description: 'Filter by published status (true for published only)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of blogs retrieved successfully',
    type: BlogListResponseDto,
  })
  async findAll(
    @Query('category', new DefaultValuePipe(undefined))
    category?: string,
    @Query('published', new DefaultValuePipe(undefined))
    published?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe)
    limit: number = 10,
  ): Promise<BlogListResponseDto> {
    const isPublished =
      published !== undefined ? published === 'true' : undefined;

    return this.blogService.findAll(category, isPublished, page, limit);
  }

  /**
   * Get blog categories with count
   */
  @Get('categories')
  @ApiOperation({ summary: 'Get all blog categories with post count' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
          },
          count: { type: 'number' },
        },
      },
    },
  })
  async getCategories() {
    return this.blogService.getCategories();
  }

  /**
   * Get all blog categories for dropdown
   */
  @Get('categories/dropdown')
  @ApiOperation({ summary: 'Get all blog categories for dropdown (id and name only)' })
  @ApiResponse({
    status: 200,
    description: 'List of blog categories for dropdown',
    type: Array,
  })
  async getCategoriesForDropdown(): Promise<{ id: number; name: string }[]> {
    return this.blogService.findAllCategoriesForDropdown();
  }

  /**
   * Get all blog categories
   */
  @Get('categories/all')
  @ApiOperation({ summary: 'Get all blog categories with full details' })
  @ApiResponse({
    status: 200,
    description: 'List of all blog categories',
    type: [BlogCategoryResponseDto],
  })
  async getAllCategories(): Promise<BlogCategoryResponseDto[]> {
    return this.blogService.findAllCategories();
  }

  /**
   * Create a blog category (simple - just name)
   */
  @Post('categories/simple')
  @ApiOperation({ summary: 'Create a blog category (simple - just name)' })
  @ApiResponse({
    status: 201,
    description: 'Blog category created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - category already exists' })
  async createCategorySimple(
    @Body() createCategorySimpleDto: CreateBlogCategorySimpleDto,
  ): Promise<{ id: number; name: string }> {
    return this.blogService.createCategorySimple(createCategorySimpleDto.category);
  }

  /**
   * Get a blog category by ID
   */
  @Get('categories/:id')
  @ApiOperation({ summary: 'Get a blog category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Category details',
    type: BlogCategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryById(@Param('id', ParseIntPipe) id: number): Promise<BlogCategoryResponseDto> {
    const category = await this.blogService.findAllCategories();
    const found = category.find((cat) => cat.id === id);
    if (!found) {
      throw new NotFoundException(`Blog category with ID "${id}" not found`);
    }
    return found;
  }

  /**
   * Update a blog category
   */
  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a blog category' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Blog category updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Bad request - category already exists' })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateBlogCategoryDto,
  ): Promise<{ id: number; name: string }> {
    return this.blogService.updateCategory(id, updateCategoryDto);
  }

  /**
   * Delete a blog category
   */
  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a blog category' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({ status: 204, description: 'Blog category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async removeCategory(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.blogService.removeCategory(id);
  }

  /**
   * Get a single blog by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a blog post by ID' })
  @ApiParam({
    name: 'id',
    description: 'Blog ID (UUID)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Blog retrieved successfully',
    type: BlogResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Blog not found',
  })
  async findOne(@Param('id') id: string): Promise<BlogResponseDto> {
    return this.blogService.findOne(id);
  }

  /**
   * Get a single blog by slug
   * This is the endpoint used when users click on a blog from the frontend
   * Returns formatted response: Title -> Image -> Array of content sections
   */
  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get a blog post by slug (for frontend blog details page)',
    description:
      'Returns blog details formatted for the frontend: title, image, and array of content sections with title, description, and image',
  })
  @ApiParam({
    name: 'slug',
    description: 'Blog slug (URL-friendly identifier)',
    type: String,
    example: 'how-escrowly-ensures-safe-transactions',
  })
  @ApiResponse({
    status: 200,
    description:
      'Blog retrieved successfully with formatted details: title, image, and content sections array',
    type: BlogDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Blog not found',
  })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<BlogDetailsResponseDto> {
    return this.blogService.findBySlug(slug);
  }

  /**
   * Update a blog post (Admin only)
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a blog post' })
  @ApiParam({
    name: 'id',
    description: 'Blog ID (UUID)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Blog updated successfully',
    type: BlogResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Blog not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation error',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
  ): Promise<BlogResponseDto> {
    return this.blogService.update(id, updateBlogDto);
  }

  /**
   * Delete a blog post (Admin only)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a blog post' })
  @ApiParam({
    name: 'id',
    description: 'Blog ID (UUID)',
    type: String,
  })
  @ApiResponse({
    status: 204,
    description: 'Blog deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Blog not found',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.blogService.remove(id);
  }
}

