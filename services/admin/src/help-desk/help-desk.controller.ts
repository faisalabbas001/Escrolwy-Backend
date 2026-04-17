import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { HelpDeskService } from './help-desk.service';
import {
  CreateCategoryDto,
  CreateCategorySimpleDto,
  UpdateCategoryDto,
  CreateQuestionDto,
  UpdateQuestionDto,
  CategoryResponseDto,
  QuestionResponseDto,
  CategoryWithQuestionsDto,
  CreateHelpDeskDto,
  UpdateHelpDeskDto,
  HelpDeskItemResponseDto,
} from './dto';

@ApiTags('Help Desk')
@Controller('admin/help-desk')
export class HelpDeskController {
  constructor(private readonly helpDeskService: HelpDeskService) {}

  // ====================================
  // Category Endpoints
  // ====================================

  @Post('categories')
  @ApiOperation({ summary: 'Create a new help desk category' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.helpDeskService.createCategory(createCategoryDto);
  }

  @Get('categories/dropdown')
  @ApiOperation({ summary: 'Get all categories for dropdown' })
  @ApiResponse({
    status: 200,
    description: 'List of categories for dropdown',
  })
  async getCategoriesForDropdown(): Promise<{ id: number; name: string }[]> {
    return this.helpDeskService.findAllCategoriesForDropdown();
  }

  @Post('categories/simple')
  @ApiOperation({ summary: 'Create a category (simple - just name)' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - category already exists' })
  async createCategorySimple(
    @Body() createCategorySimpleDto: CreateCategorySimpleDto,
  ): Promise<{ id: number; name: string }> {
    return this.helpDeskService.createCategorySimple(createCategorySimpleDto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all help desk categories' })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
    type: [CategoryResponseDto],
  })
  async findAllCategories(): Promise<CategoryResponseDto[]> {
    return this.helpDeskService.findAllCategories();
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Category details',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findCategoryById(@Param('id') id: string): Promise<CategoryResponseDto> {
    return this.helpDeskService.findCategoryById(parseInt(id, 10));
  }

  @Get('categories/slug/:slug')
  @ApiOperation({ summary: 'Get a category by slug with questions' })
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiResponse({
    status: 200,
    description: 'Category with questions',
    type: CategoryWithQuestionsDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findCategoryBySlug(
    @Param('slug') slug: string,
  ): Promise<CategoryWithQuestionsDto> {
    return this.helpDeskService.findCategoryBySlug(slug);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.helpDeskService.updateCategory(parseInt(id, 10), updateCategoryDto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'Category ID', type: Number })
  @ApiResponse({ status: 204, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async removeCategory(@Param('id') id: string): Promise<void> {
    return this.helpDeskService.removeCategory(parseInt(id, 10));
  }

  // ====================================
  // Question Endpoints
  // ====================================

  @Post('questions')
  @ApiOperation({ summary: 'Create a new help desk question' })
  @ApiResponse({
    status: 201,
    description: 'Question created successfully',
    type: QuestionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async createQuestion(
    @Body() createQuestionDto: CreateQuestionDto,
  ): Promise<QuestionResponseDto> {
    return this.helpDeskService.createQuestion(createQuestionDto);
  }

  @Get('questions')
  @ApiOperation({ summary: 'Get all help desk questions' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: Number,
    description: 'Filter by category ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of questions',
    type: [QuestionResponseDto],
  })
  async findAllQuestions(
    @Query('categoryId') categoryId?: string,
  ): Promise<QuestionResponseDto[]> {
    return this.helpDeskService.findAllQuestions(
      categoryId ? parseInt(categoryId, 10) : undefined,
    );
  }

  @Get('questions/:id')
  @ApiOperation({ summary: 'Get a question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Question details',
    type: QuestionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async findQuestionById(@Param('id') id: string): Promise<QuestionResponseDto> {
    return this.helpDeskService.findQuestionById(parseInt(id, 10));
  }

  @Get('questions/slug/:slug')
  @ApiOperation({ summary: 'Get a question by slug' })
  @ApiParam({ name: 'slug', description: 'Question slug' })
  @ApiResponse({
    status: 200,
    description: 'Question details',
    type: QuestionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async findQuestionBySlug(@Param('slug') slug: string): Promise<QuestionResponseDto> {
    return this.helpDeskService.findQuestionBySlug(slug);
  }

  @Patch('questions/:id')
  @ApiOperation({ summary: 'Update a question' })
  @ApiParam({ name: 'id', description: 'Question ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Question updated successfully',
    type: QuestionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Question not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() updateQuestionDto: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    return this.helpDeskService.updateQuestion(parseInt(id, 10), updateQuestionDto);
  }

  @Delete('questions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a question' })
  @ApiParam({ name: 'id', description: 'Question ID', type: Number })
  @ApiResponse({ status: 204, description: 'Question deleted successfully' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async removeQuestion(@Param('id') id: string): Promise<void> {
    return this.helpDeskService.removeQuestion(parseInt(id, 10));
  }

  // ====================================
  // Unified Help Desk Endpoints
  // ====================================

  @Post()
  @ApiOperation({ summary: 'Create a help desk item with questions (unified)' })
  @ApiResponse({
    status: 201,
    description: 'Help desk item created successfully with questions',
    type: HelpDeskItemResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createHelpDeskItem(
    @Body() createHelpDeskDto: CreateHelpDeskDto,
  ): Promise<HelpDeskItemResponseDto> {
    return this.helpDeskService.createHelpDeskItem(createHelpDeskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all help desk items with category and questions (unified)' })
  @ApiResponse({
    status: 200,
    description: 'List of help desk items with nested data',
    type: [HelpDeskItemResponseDto],
  })
  async findAllHelpDeskItems(): Promise<HelpDeskItemResponseDto[]> {
    return this.helpDeskService.findAllHelpDeskItems();
  }

  @Get('item/:id')
  @ApiOperation({ summary: 'Get help desk item by ID' })
  @ApiParam({ name: 'id', description: 'Help desk item ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Help desk item with category and questions',
    type: HelpDeskItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Help desk item not found' })
  async findHelpDeskItemById(@Param('id') id: string): Promise<HelpDeskItemResponseDto> {
    return this.helpDeskService.findHelpDeskItemById(parseInt(id, 10));
  }

  @Patch('item/:id')
  @ApiOperation({ summary: 'Update a help desk item' })
  @ApiParam({ name: 'id', description: 'Help desk item ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Help desk item updated successfully',
    type: HelpDeskItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Help desk item not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateHelpDeskItem(
    @Param('id') id: string,
    @Body() updateHelpDeskDto: UpdateHelpDeskDto,
  ): Promise<HelpDeskItemResponseDto> {
    return this.helpDeskService.updateHelpDeskItem(parseInt(id, 10), updateHelpDeskDto);
  }

  @Delete('item/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a help desk item' })
  @ApiParam({ name: 'id', description: 'Help desk item ID', type: Number })
  @ApiResponse({ status: 204, description: 'Help desk item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Help desk item not found' })
  async removeHelpDeskItem(@Param('id') id: string): Promise<void> {
    return this.helpDeskService.removeHelpDeskItem(parseInt(id, 10));
  }
}

