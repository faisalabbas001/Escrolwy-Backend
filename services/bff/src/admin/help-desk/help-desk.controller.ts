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
 * Help Desk Controller (BFF → Admin Service)
 * 
 * Routes for FAQ/Help Desk management
 */
@ApiTags('admin/help-desk')
@Controller({ path: 'admin/help-desk', version: '1' })
export class HelpDeskController {
  private readonly logger = new Logger(HelpDeskController.name);

  constructor(private readonly proxyService: ProxyService) {}

  // ====================================
  // Category Endpoints
  // ====================================

  /**
   * Get all categories (public - for landing page)
   */
  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get all help desk categories' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async findAllCategories(): Promise<any> {
    this.logger.log('[BFF → Admin] GET /api/v1/admin/help-desk/categories');
    return this.proxyService.proxyToAdmin('GET', '/api/v1/admin/help-desk/categories');
  }

  /**
   * Get categories for dropdown (public)
   */
  @Public()
  @Get('categories/dropdown')
  @ApiOperation({ summary: 'Get help desk categories for dropdown' })
  @ApiResponse({ status: 200, description: 'List of categories for dropdown' })
  async getCategoriesForDropdown(): Promise<any> {
    this.logger.log('[BFF → Admin] GET /api/v1/admin/help-desk/categories/dropdown');
    return this.proxyService.proxyToAdmin('GET', '/api/v1/admin/help-desk/categories/dropdown');
  }

  /**
   * Create category simple (just name) (protected)
   */
  @Post('categories/simple')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a help desk category (simple - just name)' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createCategorySimple(
    @Body() body: { category: string },
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Admin] POST /api/v1/admin/help-desk/categories/simple');
    return this.proxyService.proxyToAdmin('POST', '/api/v1/admin/help-desk/categories/simple', body, {
      Authorization: authHeader,
    });
  }

  /**
   * Get category by ID (public)
   */
  @Public()
  @Get('categories/:id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findCategoryById(@Param('id') id: string): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/help-desk/categories/${id}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/help-desk/categories/${id}`);
  }

  /**
   * Get category by slug with questions (public)
   */
  @Public()
  @Get('categories/slug/:slug')
  @ApiOperation({ summary: 'Get category by slug with questions' })
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiResponse({ status: 200, description: 'Category with questions' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findCategoryBySlug(@Param('slug') slug: string): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/help-desk/categories/slug/${slug}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/help-desk/categories/slug/${slug}`);
  }

  /**
   * Create category (protected - admin only)
   */
  @Post('categories')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createCategory(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Admin] POST /api/v1/admin/help-desk/categories');
    return this.proxyService.proxyToAdmin('POST', '/api/v1/admin/help-desk/categories', body, {
      Authorization: authHeader,
    });
  }

  /**
   * Update category (protected - admin only)
   */
  @Patch('categories/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Admin] PATCH /api/v1/admin/help-desk/categories/${id}`);
    return this.proxyService.proxyToAdmin('PATCH', `/api/v1/admin/help-desk/categories/${id}`, body, {
      Authorization: authHeader,
    });
  }

  /**
   * Delete category (protected - admin only)
   */
  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 204, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async removeCategory(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    this.logger.log(`[BFF → Admin] DELETE /api/v1/admin/help-desk/categories/${id}`);
    await this.proxyService.proxyToAdmin('DELETE', `/api/v1/admin/help-desk/categories/${id}`, null, {
      Authorization: authHeader,
    });
  }

  // ====================================
  // Question Endpoints
  // ====================================

  /**
   * Get all questions (public)
   */
  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Get all questions' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID' })
  @ApiResponse({ status: 200, description: 'List of questions' })
  async findAllQuestions(@Query('categoryId') categoryId?: string): Promise<any> {
    const path = categoryId 
      ? `/api/v1/admin/help-desk/questions?categoryId=${categoryId}`
      : '/api/v1/admin/help-desk/questions';
    this.logger.log(`[BFF → Admin] GET ${path}`);
    return this.proxyService.proxyToAdmin('GET', path);
  }

  /**
   * Get question by ID (public)
   */
  @Public()
  @Get('questions/:id')
  @ApiOperation({ summary: 'Get question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question details' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async findQuestionById(@Param('id') id: string): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/help-desk/questions/${id}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/help-desk/questions/${id}`);
  }

  /**
   * Get question by slug (public)
   */
  @Public()
  @Get('questions/slug/:slug')
  @ApiOperation({ summary: 'Get question by slug' })
  @ApiParam({ name: 'slug', description: 'Question slug' })
  @ApiResponse({ status: 200, description: 'Question details' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async findQuestionBySlug(@Param('slug') slug: string): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/help-desk/questions/slug/${slug}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/help-desk/questions/slug/${slug}`);
  }

  /**
   * Create question (protected - admin only)
   */
  @Post('questions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new question' })
  @ApiResponse({ status: 201, description: 'Question created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createQuestion(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Admin] POST /api/v1/admin/help-desk/questions');
    return this.proxyService.proxyToAdmin('POST', '/api/v1/admin/help-desk/questions', body, {
      Authorization: authHeader,
    });
  }

  /**
   * Update question (protected - admin only)
   */
  @Patch('questions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a question' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question updated' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Admin] PATCH /api/v1/admin/help-desk/questions/${id}`);
    return this.proxyService.proxyToAdmin('PATCH', `/api/v1/admin/help-desk/questions/${id}`, body, {
      Authorization: authHeader,
    });
  }

  /**
   * Delete question (protected - admin only)
   */
  @Delete('questions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a question' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 204, description: 'Question deleted' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async removeQuestion(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    this.logger.log(`[BFF → Admin] DELETE /api/v1/admin/help-desk/questions/${id}`);
    await this.proxyService.proxyToAdmin('DELETE', `/api/v1/admin/help-desk/questions/${id}`, null, {
      Authorization: authHeader,
    });
  }

  // ====================================
  // Unified Help Desk Item Endpoints
  // ====================================

  /**
   * Create a help desk item with questions (unified) (protected)
   */
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a help desk item with questions (unified)' })
  @ApiResponse({ status: 201, description: 'Help desk item created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createHelpDeskItem(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Admin] POST /api/v1/admin/help-desk');
    return this.proxyService.proxyToAdmin('POST', '/api/v1/admin/help-desk', body, {
      Authorization: authHeader,
    });
  }

  /**
   * Get all help desk items (public)
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all help desk items with category and questions' })
  @ApiResponse({ status: 200, description: 'List of help desk items' })
  async getHelpDeskItems(): Promise<any> {
    this.logger.log('[BFF → Admin] GET /api/v1/admin/help-desk');
    return this.proxyService.proxyToAdmin('GET', '/api/v1/admin/help-desk');
  }

  /**
   * Get help desk item by ID (public)
   */
  @Public()
  @Get('item/:id')
  @ApiOperation({ summary: 'Get help desk item by ID' })
  @ApiParam({ name: 'id', description: 'Help desk item ID' })
  @ApiResponse({ status: 200, description: 'Help desk item details' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getHelpDeskItemById(@Param('id') id: string): Promise<any> {
    this.logger.log(`[BFF → Admin] GET /api/v1/admin/help-desk/item/${id}`);
    return this.proxyService.proxyToAdmin('GET', `/api/v1/admin/help-desk/item/${id}`);
  }

  /**
   * Update help desk item (protected)
   */
  @Patch('item/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a help desk item' })
  @ApiParam({ name: 'id', description: 'Help desk item ID' })
  @ApiResponse({ status: 200, description: 'Help desk item updated' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateHelpDeskItem(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Admin] PATCH /api/v1/admin/help-desk/item/${id}`);
    return this.proxyService.proxyToAdmin('PATCH', `/api/v1/admin/help-desk/item/${id}`, body, {
      Authorization: authHeader,
    });
  }

  /**
   * Delete help desk item (protected)
   */
  @Delete('item/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a help desk item' })
  @ApiParam({ name: 'id', description: 'Help desk item ID' })
  @ApiResponse({ status: 204, description: 'Help desk item deleted' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async removeHelpDeskItem(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    this.logger.log(`[BFF → Admin] DELETE /api/v1/admin/help-desk/item/${id}`);
    await this.proxyService.proxyToAdmin('DELETE', `/api/v1/admin/help-desk/item/${id}`, null, {
      Authorization: authHeader,
    });
  }
}

