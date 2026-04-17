import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProxyService } from '../../proxy';
import { Public } from '../../common';

/**
 * Blogs Controller (BFF → Admin Service)
 * 
 * Routes:
 * - Public: GET /api/v1/admin/blogs (list, with filters)
 * - Public: GET /api/v1/admin/blogs/categories
 * - Public: GET /api/v1/admin/blogs/slug/:slug
 * - Protected: GET /api/v1/admin/blogs/:id
 * - Protected: POST /api/v1/admin/blogs
 * - Protected: PATCH /api/v1/admin/blogs/:id
 * - Protected: DELETE /api/v1/admin/blogs/:id
 */
@ApiTags('admin/blogs')
@Controller({ path: 'admin/blogs', version: '1' })
export class BlogsController {
  private readonly logger = new Logger(BlogsController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Get all blogs (public - for landing page)
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all blogs with filtering and pagination' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'published', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'List of blogs' })
  async findAll(
    @Query('category') category?: string,
    @Query('published') published?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (category) queryParams.append('category', category);
    if (published) queryParams.append('published', published);
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);

    const queryString = queryParams.toString();
    const path = `/api/v1/admin/blogs${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Admin] GET ${path}`);
    return this.proxyService.proxyToAdmin('GET', path);
  }

  /**
   * Get blog categories with count (public)
   */
  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get all blog categories with count' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories(): Promise<any> {
    this.logger.log('[BFF → Admin] GET /api/v1/admin/blogs/categories');
    return this.proxyService.proxyToAdmin('GET', '/api/v1/admin/blogs/categories');
  }

  /**
   * Get blog categories for dropdown (public)
   */
  @Public()
  @Get('categories/dropdown')
  @ApiOperation({ summary: 'Get all blog categories for dropdown' })
  @ApiResponse({ status: 200, description: 'List of categories for dropdown' })
  async getCategoriesForDropdown(): Promise<any> {
    this.logger.log('[BFF → Admin] GET /api/v1/admin/blogs/categories/dropdown');
    return this.proxyService.proxyToAdmin('GET', '/api/v1/admin/blogs/categories/dropdown');
  }

  /**
   * Get all blog categories with full details (public)
   */
  @Public()
  @Get('categories/all')
  @ApiOperation({ summary: 'Get all blog categories with full details' })
  @ApiResponse({ status: 200, description: 'List of all categories' })
  async getAllCategories(): Promise<any> {
    this.logger.log('[BFF → Admin] GET /api/v1/admin/blogs/categories/all');
    return this.proxyService.proxyToAdmin('GET', '/api/v1/admin/blogs/categories/all');
  }

  /**
   * Create blog category (simple - just name) (protected)
   */
  @Post('categories/simple')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a blog category (simple - just name)' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createCategorySimple(
    @Body() body: { category: string },
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Admin] POST /api/v1/admin/blogs/categories/simple');
    return this.proxyService.proxyToAdmin('POST', '/api/v1/admin/blogs/categories/simple', body, {
      Authorization: authHeader,
    });
  }

  /**
   * Get blog category by ID (protected)
   */
  @Get('categories/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a blog category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryById(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/blogs/categories/${id}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/blogs/categories/${id}`, null, {
      Authorization: authHeader,
    });
  }

  /**
   * Update blog category (protected)
   */
  @Patch('categories/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a blog category' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Bad request - category already exists' })
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { category?: string },
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Admin] PATCH /api/v1/admin/blogs/categories/${id}`);
    return this.proxyService.proxyToAdmin('PATCH', `/api/v1/admin/blogs/categories/${id}`, body, {
      Authorization: authHeader,
    });
  }

  /**
   * Delete blog category (protected)
   */
  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a blog category' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({ status: 204, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async deleteCategory(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    this.logger.log(`[BFF → Admin] DELETE /api/v1/admin/blogs/categories/${id}`);
    await this.proxyService.proxyToAdmin('DELETE', `/api/v1/admin/blogs/categories/${id}`, null, {
      Authorization: authHeader,
    });
  }

  /**
   * Get blog by slug (public - for blog detail page)
   */
  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get blog by slug (for frontend blog detail)' })
  @ApiParam({ name: 'slug', description: 'Blog slug' })
  @ApiResponse({ status: 200, description: 'Blog details' })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async findBySlug(@Param('slug') slug: string): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/blogs/slug/${slug}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/blogs/slug/${slug}`);
  }

  /**
   * Get blog by ID (protected - admin only)
   */
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get blog by ID' })
  @ApiParam({ name: 'id', description: 'Blog ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Blog details' })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/blogs/${id}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/blogs/${id}`, null, {
      Authorization: authHeader,
    });
  }

  /**
   * Create blog (protected - admin only)
   */
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new blog post' })
  @ApiResponse({ status: 201, description: 'Blog created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Admin] POST /api/v1/admin/blogs');
    return this.proxyService.proxyToAdmin('POST', '/api/v1/admin/blogs', body, {
      Authorization: authHeader,
    });
  }

  /**
   * Update blog (protected - admin only)
   */
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a blog post' })
  @ApiParam({ name: 'id', description: 'Blog ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Blog updated successfully' })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Admin] PATCH /api/v1/admin/blogs/${id}`);
    return this.proxyService.proxyToAdmin('PATCH', `/api/v1/admin/blogs/${id}`, body, {
      Authorization: authHeader,
    });
  }

  /**
   * Delete blog (protected - admin only)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a blog post' })
  @ApiParam({ name: 'id', description: 'Blog ID (UUID)' })
  @ApiResponse({ status: 204, description: 'Blog deleted successfully' })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async remove(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    this.logger.log(`[BFF → Admin] DELETE /api/v1/admin/blogs/${id}`);
    await this.proxyService.proxyToAdmin('DELETE', `/api/v1/admin/blogs/${id}`, null, {
      Authorization: authHeader,
    });
  }
}

