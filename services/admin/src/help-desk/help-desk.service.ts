import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { CacheService } from '../cache';
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
import { Prisma } from '../../generated/prisma';

/**
 * Help Desk Service
 * Handles all business logic for help desk operations
 */
@Injectable()
export class HelpDeskService {
  private readonly logger = new Logger(HelpDeskService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  // ====================================
  // Category Operations
  // ====================================

  /**
   * Create a new category
   */
  async createCategory(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    try {
      // Check if slug already exists
      const existingCategory = await this.prisma.helpDeskCategory.findUnique({
        where: { slug: createCategoryDto.slug },
      });

      if (existingCategory) {
        throw new BadRequestException(
          `Category with slug "${createCategoryDto.slug}" already exists`,
        );
      }

      const category = await this.prisma.helpDeskCategory.create({
        data: {
          name: createCategoryDto.title, // Map title to name for backward compatibility
          slug: createCategoryDto.slug,
        },
        include: {
          _count: {
            select: { items: true }, // Categories now have items, not questions
          },
        },
      });

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();

      return this.mapToCategoryResponse(category);
    } catch (error) {
      this.logger.error(`Error creating category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Ensure default "General" category exists
   */
  private async ensureDefaultCategory(): Promise<void> {
    try {
      const defaultName = 'General';
      const defaultSlug = 'general';

      const existing = await this.prisma.helpDeskCategory.findFirst({
        where: {
          OR: [{ name: defaultName }, { slug: defaultSlug }],
        },
      });

      if (!existing) {
        await this.prisma.helpDeskCategory.create({
          data: {
            name: defaultName,
            slug: defaultSlug,
          },
        });
        this.logger.log('Default "General" help desk category created');
        // Invalidate cache after creating default category
        await this.cacheService.invalidateHelpDeskCache();
      }
    } catch (error) {
      this.logger.error(
        `Error ensuring default category: ${error.message}`,
        error.stack
      );
      // Don't throw - allow operation to continue even if default category creation fails
    }
  }

  /**
   * Get all categories
   */
  async findAllCategories(): Promise<CategoryResponseDto[]> {
    try {
      // Ensure default category exists
      await this.ensureDefaultCategory();

      // Try cache first
      const cacheKey = 'helpdesk:categories:all';
      const cached = await this.cacheService.get<CategoryResponseDto[]>(cacheKey);
      if (cached) return cached;

      const categories = await this.prisma.helpDeskCategory.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      const result = categories.map((cat) => this.mapToCategoryResponse(cat));
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching categories: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async findCategoryById(id: number): Promise<CategoryResponseDto> {
    try {
      // Try cache first
      const cacheKey = `helpdesk:category:${id}`;
      const cached = await this.cacheService.get<CategoryResponseDto>(cacheKey);
      if (cached) return cached;

      const category = await this.prisma.helpDeskCategory.findUnique({
        where: { id },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID "${id}" not found`);
      }

      const result = this.mapToCategoryResponse(category);
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get category by slug (with questions)
   */
  async findCategoryBySlug(slug: string): Promise<CategoryWithQuestionsDto> {
    try {
      // Try cache first
      const cacheKey = `helpdesk:category:slug:${slug}`;
      const cached = await this.cacheService.get<CategoryWithQuestionsDto>(cacheKey);
      if (cached) return cached;

      const category = await this.prisma.helpDeskCategory.findUnique({
        where: { slug },
        include: {
          items: {
            include: {
              questions: {
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      if (!category) {
        throw new NotFoundException(`Category with slug "${slug}" not found`);
      }

      // Flatten questions from all items
      const allQuestions = category.items.flatMap((item) => item.questions);

      const result = {
        ...this.mapToCategoryResponse(category),
        questions: allQuestions.map((q) => this.mapToQuestionResponse(q)),
      };

      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching category by slug: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    try {
      // Check if category exists
      const existingCategory = await this.prisma.helpDeskCategory.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        throw new NotFoundException(`Category with ID "${id}" not found`);
      }

      // Prepare update data - map title to name for database
      const updateData: any = {};
      
      if (updateCategoryDto.title) {
        updateData.name = updateCategoryDto.title.trim();
      }
      
      if (updateCategoryDto.slug) {
        // Check if slug is being updated and already exists
        if (updateCategoryDto.slug !== existingCategory.slug) {
          const slugExists = await this.prisma.helpDeskCategory.findUnique({
            where: { slug: updateCategoryDto.slug },
          });

          if (slugExists) {
            throw new BadRequestException(
              `Category with slug "${updateCategoryDto.slug}" already exists`,
            );
          }
        }
        updateData.slug = updateCategoryDto.slug.trim();
      }

      const category = await this.prisma.helpDeskCategory.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();

      return this.mapToCategoryResponse(category);
    } catch (error) {
      this.logger.error(`Error updating category: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a category
   * Automatically reassigns help desk items to "General" category if category is in use
   */
  async removeCategory(id: number): Promise<void> {
    try {
      const category = await this.prisma.helpDeskCategory.findUnique({
        where: { id },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID "${id}" not found`);
      }

      // If category has items, reassign them to "General" category
      if (category._count.items > 0) {
        // Find or create "General" category
        let generalCategory = await this.prisma.helpDeskCategory.findFirst({
          where: {
            OR: [{ name: 'General' }, { slug: 'general' }],
          },
        });

        if (!generalCategory) {
          // Create "General" category if it doesn't exist
          generalCategory = await this.prisma.helpDeskCategory.create({
            data: {
              name: 'General',
              slug: 'general',
            },
          });
          this.logger.log('Default "General" help desk category created during deletion');
        }

        // Reassign all items from this category to "General"
        await this.prisma.helpDeskItem.updateMany({
          where: { categoryId: id },
          data: { categoryId: generalCategory.id },
        });

        this.logger.log(
          `Reassigned ${category._count.items} help desk item(s) from category "${category.name}" to "General"`,
        );
      }

      // Now safe to delete the category (cascade delete will handle questions)
      await this.prisma.helpDeskCategory.delete({
        where: { id },
      });

      this.logger.log(`Help desk category deleted: ${category.name} (ID: ${id})`);

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();
    } catch (error) {
      this.logger.error(`Error deleting category: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ====================================
  // Question Operations
  // ====================================

  /**
   * Create a new question
   */
  async createQuestion(
    createQuestionDto: CreateQuestionDto,
  ): Promise<QuestionResponseDto> {
    try {
      // Verify category exists
      const category = await this.prisma.helpDeskCategory.findUnique({
        where: { id: createQuestionDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException(
          `Category with ID "${createQuestionDto.categoryId}" not found`,
        );
      }

      // NOTE: This method uses old schema. Questions now belong to items, not categories.
      // This method is deprecated - use createHelpDeskItem instead.
      throw new BadRequestException(
        'This method is deprecated. Use POST /help-desk to create items with questions.',
      );
    } catch (error) {
      this.logger.error(`Error creating question: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all questions (optionally filtered by category)
   */
  async findAllQuestions(categoryId?: number): Promise<QuestionResponseDto[]> {
    try {
      // Try cache first
      const cacheKey = `helpdesk:questions:${categoryId || 'all'}`;
      const cached = await this.cacheService.get<QuestionResponseDto[]>(cacheKey);
      if (cached) return cached;

      // Note: In new schema, questions belong to items, not categories directly
      // Filtering by categoryId requires joining through items
      const where: Prisma.HelpDeskQuestionWhereInput = categoryId
        ? {
            item: {
              categoryId: categoryId,
            },
          }
        : {};

      const questions = await this.prisma.helpDeskQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          item: {
            include: {
              category: true,
            },
          },
        },
      });

      const result = questions.map((q) => this.mapToQuestionResponse(q));
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching questions: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get question by ID
   */
  async findQuestionById(id: number): Promise<QuestionResponseDto> {
    try {
      // Try cache first
      const cacheKey = `helpdesk:question:${id}`;
      const cached = await this.cacheService.get<QuestionResponseDto>(cacheKey);
      if (cached) return cached;

      const question = await this.prisma.helpDeskQuestion.findUnique({
        where: { id },
        include: {
          item: {
            include: {
              category: true,
            },
          },
        },
      });

      if (!question) {
        throw new NotFoundException(`Question with ID "${id}" not found`);
      }

      const result = this.mapToQuestionResponse(question);
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching question: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get question by slug
   * NOTE: Questions don't have slugs in new schema - this method is deprecated
   */
  async findQuestionBySlug(slug: string): Promise<QuestionResponseDto> {
    throw new BadRequestException(
      'This method is deprecated. Questions no longer have slugs. Use findQuestionById instead.',
    );
  }

  /**
   * Update a question
   */
  async updateQuestion(
    id: number,
    updateQuestionDto: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    try {
      const existingQuestion = await this.prisma.helpDeskQuestion.findUnique({
        where: { id },
      });

      if (!existingQuestion) {
        throw new NotFoundException(`Question with ID "${id}" not found`);
      }

      // If categoryId is being updated, verify it exists
      if (updateQuestionDto.categoryId) {
        const category = await this.prisma.helpDeskCategory.findUnique({
          where: { id: updateQuestionDto.categoryId },
        });

        if (!category) {
          throw new NotFoundException(
            `Category with ID "${updateQuestionDto.categoryId}" not found`,
          );
        }
      }

      // NOTE: Questions don't have slugs in new schema - remove slug from update data
      const updateData: any = { ...updateQuestionDto };
      delete updateData.slug;
      delete updateData.categoryId; // Questions belong to items, not categories

      const question = await this.prisma.helpDeskQuestion.update({
        where: { id },
        data: updateData,
        include: {
          item: {
            include: {
              category: true,
            },
          },
        },
      });

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();

      return this.mapToQuestionResponse(question);
    } catch (error) {
      this.logger.error(`Error updating question: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a question
   */
  async removeQuestion(id: number): Promise<void> {
    try {
      const question = await this.prisma.helpDeskQuestion.findUnique({
        where: { id },
      });

      if (!question) {
        throw new NotFoundException(`Question with ID "${id}" not found`);
      }

      await this.prisma.helpDeskQuestion.delete({
        where: { id },
      });

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();
    } catch (error) {
      this.logger.error(`Error deleting question: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ====================================
  // Helper Methods
  // ====================================

  /**
   * Strip HTML tags from text and generate a URL-friendly slug
   * @param text - Text that may contain HTML tags
   * @returns URL-friendly slug
   */
  private generateSlug(text: string): string {
    if (!text) return '';
    
    // Strip HTML tags by removing everything between < and >
    let plainText = text.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities (optional, but helpful)
    plainText = plainText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Generate slug from plain text
    return plainText
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private mapToCategoryResponse(category: any): CategoryResponseDto {
    return {
      id: category.id,
      title: category.name || category.title, // Support both old and new schema
      slug: category.slug,
      questionCount: category._count?.items || 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private mapToQuestionResponse(question: any): QuestionResponseDto {
    // Support both old schema (with categoryId, slug) and new schema (with itemId, no slug)
    return {
      id: question.id,
      categoryId: question.categoryId || question.item?.categoryId || 0,
      question: question.question,
      answer: question.answer,
      slug: question.slug || '', // New schema doesn't have slug
      category: question.category
        ? this.mapToCategoryResponse(question.category)
        : question.item?.category
        ? this.mapToCategoryResponse(question.item.category)
        : undefined,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  // ====================================
  // Unified Help Desk Operations
  // ====================================

  /**
   * Create a help desk item with questions in a single transaction
   */
  async createHelpDeskItem(
    createHelpDeskDto: CreateHelpDeskDto,
  ): Promise<HelpDeskItemResponseDto> {
    try {
      // Find or create category by name
      let category = await this.prisma.helpDeskCategory.findFirst({
        where: { name: createHelpDeskDto.category.trim() },
      });

      if (!category) {
        // Create category if it doesn't exist
        const categorySlug = this.generateSlug(createHelpDeskDto.category);

        category = await this.prisma.helpDeskCategory.create({
          data: {
            name: createHelpDeskDto.category.trim(),
            slug: categorySlug,
          },
        });
      }

      // Generate slug from title (strip HTML first)
      const itemSlug = this.generateSlug(createHelpDeskDto.title);

      // Check if slug already exists
      const existingItem = await this.prisma.helpDeskItem.findUnique({
        where: { slug: itemSlug },
      });

      if (existingItem) {
        throw new BadRequestException(
          `Item with slug "${itemSlug}" already exists`,
        );
      }

      // Create item with questions in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the item
        const item = await tx.helpDeskItem.create({
          data: {
            title: createHelpDeskDto.title.trim(),
            slug: itemSlug,
            categoryId: category.id,
            imageUrl: createHelpDeskDto.imageUrl || null,
            youtubeLink: createHelpDeskDto.youtubeLink || null,
          },
        });

        // Create all questions
        const questions = await Promise.all(
          createHelpDeskDto.questions.map((q) =>
            tx.helpDeskQuestion.create({
              data: {
                question: q.question.trim(),
                answer: q.answer.trim(),
                itemId: item.id,
              },
            }),
          ),
        );

        // Fetch the complete item with relations
        return tx.helpDeskItem.findUnique({
          where: { id: item.id },
          include: {
            category: true,
            questions: true,
          },
        });
      });

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();

      return this.mapToHelpDeskItemResponse(result);
    } catch (error) {
      this.logger.error(
        `Error creating help desk item: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all help desk items with category and questions
   */
  async findAllHelpDeskItems(): Promise<HelpDeskItemResponseDto[]> {
    try {
      // Try cache first
      const cacheKey = 'helpdesk:items:all';
      const cached = await this.cacheService.get<HelpDeskItemResponseDto[]>(cacheKey);
      if (cached) return cached;

      const items = await this.prisma.helpDeskItem.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          questions: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const result = items.map((item) => this.mapToHelpDeskItemResponse(item));
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching help desk items: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create a simple category (just name, auto-generate slug)
   */
  async createCategorySimple(
    createCategorySimpleDto: CreateCategorySimpleDto,
  ): Promise<{ id: number; name: string }> {
    try {
      const categoryName = createCategorySimpleDto.category.trim();
      
      // Generate slug from category name (strip HTML first)
      const slug = this.generateSlug(categoryName);

      // Check if category already exists
      const existing = await this.prisma.helpDeskCategory.findFirst({
        where: {
          OR: [
            { name: categoryName },
            { slug: slug },
          ],
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Category "${categoryName}" already exists`,
        );
      }

      const category = await this.prisma.helpDeskCategory.create({
        data: {
          name: categoryName,
          slug: slug,
        },
        select: {
          id: true,
          name: true,
        },
      });

      this.logger.log(`Category created: ${category.name} (ID: ${category.id})`);

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();

      return category;
    } catch (error) {
      this.logger.error(
        `Error creating category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all categories (for dropdown)
   */
  async findAllCategoriesForDropdown(): Promise<{ id: number; name: string }[]> {
    try {
      // Ensure default category exists
      await this.ensureDefaultCategory();

      // Try cache first
      const cacheKey = 'helpdesk:categories:dropdown';
      const cached = await this.cacheService.get<{ id: number; name: string }[]>(cacheKey);
      if (cached) return cached;

      const categories = await this.prisma.helpDeskCategory.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
        },
      });

      await this.cacheService.set(cacheKey, categories, this.CACHE_TTL);

      return categories;
    } catch (error) {
      this.logger.error(
        `Error fetching categories for dropdown: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get help desk item by ID
   */
  async findHelpDeskItemById(id: number): Promise<HelpDeskItemResponseDto> {
    try {
      // Try cache first
      const cacheKey = `helpdesk:item:${id}`;
      const cached = await this.cacheService.get<HelpDeskItemResponseDto>(cacheKey);
      if (cached) return cached;

      const item = await this.prisma.helpDeskItem.findUnique({
        where: { id },
        include: {
          category: true,
          questions: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!item) {
        throw new NotFoundException(`Help desk item with ID "${id}" not found`);
      }

      const result = this.mapToHelpDeskItemResponse(item);
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching help desk item: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update a help desk item
   */
  async updateHelpDeskItem(
    id: number,
    updateHelpDeskDto: UpdateHelpDeskDto,
  ): Promise<HelpDeskItemResponseDto> {
    try {
      const existingItem = await this.prisma.helpDeskItem.findUnique({
        where: { id },
      });

      if (!existingItem) {
        throw new NotFoundException(`Help desk item with ID "${id}" not found`);
      }

      // If category is being updated, verify it exists
      let category = null;
      if (updateHelpDeskDto.category) {
        category = await this.prisma.helpDeskCategory.findFirst({
          where: { name: updateHelpDeskDto.category.trim() },
        });

        if (!category) {
          throw new NotFoundException(
            `Category "${updateHelpDeskDto.category}" not found`,
          );
        }
      }

      // Generate slug if title is being updated (strip HTML first)
      let itemSlug = existingItem.slug;
      if (updateHelpDeskDto.title) {
        itemSlug = this.generateSlug(updateHelpDeskDto.title);

        // Check if slug already exists (excluding current item)
        const existingSlug = await this.prisma.helpDeskItem.findFirst({
          where: {
            slug: itemSlug,
            id: { not: id },
          },
        });

        if (existingSlug) {
          throw new BadRequestException(
            `Item with slug "${itemSlug}" already exists`,
          );
        }
      }

      // Update item and questions in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Update the item
        const updatedItem = await tx.helpDeskItem.update({
          where: { id },
          data: {
            ...(updateHelpDeskDto.title && { title: updateHelpDeskDto.title.trim() }),
            ...(itemSlug !== existingItem.slug && { slug: itemSlug }),
            ...(category && { categoryId: category.id }),
            ...(updateHelpDeskDto.imageUrl !== undefined && { imageUrl: updateHelpDeskDto.imageUrl || null }),
            ...(updateHelpDeskDto.youtubeLink !== undefined && { youtubeLink: updateHelpDeskDto.youtubeLink || null }),
          },
        });

        // If questions are being updated, delete old ones and create new ones
        if (updateHelpDeskDto.questions) {
          // Delete existing questions
          await tx.helpDeskQuestion.deleteMany({
            where: { itemId: id },
          });

          // Create new questions
          await Promise.all(
            updateHelpDeskDto.questions.map((q) =>
              tx.helpDeskQuestion.create({
                data: {
                  question: q.question.trim(),
                  answer: q.answer.trim(),
                  itemId: id,
                },
              }),
            ),
          );
        }

        // Fetch the complete item with relations
        return tx.helpDeskItem.findUnique({
          where: { id },
          include: {
            category: true,
            questions: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });
      });

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();

      return this.mapToHelpDeskItemResponse(result);
    } catch (error) {
      this.logger.error(
        `Error updating help desk item: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a help desk item
   */
  async removeHelpDeskItem(id: number): Promise<void> {
    try {
      const item = await this.prisma.helpDeskItem.findUnique({
        where: { id },
      });

      if (!item) {
        throw new NotFoundException(`Help desk item with ID "${id}" not found`);
      }

      // Delete item (questions will be deleted via cascade)
      await this.prisma.helpDeskItem.delete({
        where: { id },
      });

      // Invalidate cache
      await this.cacheService.invalidateHelpDeskCache();

      this.logger.log(`Help desk item deleted: ID ${id}`);
    } catch (error) {
      this.logger.error(
        `Error deleting help desk item: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Map database result to HelpDeskItemResponseDto
   */
  private mapToHelpDeskItemResponse(item: any): HelpDeskItemResponseDto {
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      category: {
        name: item.category.name,
      },
      questions: item.questions.map((q: any) => ({
        question: q.question,
        answer: q.answer,
      })),
      imageUrl: item.imageUrl || undefined,
      youtubeLink: item.youtubeLink || undefined,
      createdAt: item.createdAt,
    };
  }
}
