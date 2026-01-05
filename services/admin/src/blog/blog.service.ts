import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma";
import { CacheService } from "../cache";
import {
  CreateBlogDto,
  UpdateBlogDto,
  BlogResponseDto,
  BlogListItemDto,
  BlogDetailsResponseDto,
  UpdateBlogCategoryDto,
} from "./dto";
import { Blog, Prisma } from "../../generated/prisma";

/**
 * Blog Service
 * Handles all business logic for blog operations
 */
@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new blog post
   */
  async create(createBlogDto: CreateBlogDto): Promise<BlogResponseDto> {
    try {
      // Check if slug already exists
      const existingBlog = await this.prisma.blog.findUnique({
        where: { slug: createBlogDto.slug },
      });

      if (existingBlog) {
        throw new BadRequestException(
          `Blog with slug "${createBlogDto.slug}" already exists`
        );
      }

      // Find or validate category
      const category = await this.prisma.blogCategory.findFirst({
        where: { name: createBlogDto.category.trim() },
      });

      if (!category) {
        throw new BadRequestException(
          `Blog category "${createBlogDto.category}" not found. Please create it first.`
        );
      }

      // Prepare data
      const data: Prisma.BlogCreateInput = {
        title: createBlogDto.title,
        slug: createBlogDto.slug,
        category: {
          connect: { id: category.id },
        },
        imageUrl: createBlogDto.imageUrl,
        excerpt: createBlogDto.excerpt,
        readTime: createBlogDto.readTime || 4,
        isPublished: createBlogDto.isPublished || false,
        contentSections:
          createBlogDto.contentSections as unknown as Prisma.InputJsonValue,
        createdBy: createBlogDto.createdBy,
      };

      const blog = await this.prisma.blog.create({
        data,
        include: {
          category: true,
        },
      });

      this.logger.log(`Blog created: ${blog.id} - ${blog.title}`);

      // Invalidate cache
      await this.cacheService.invalidateBlogCache();

      return this.mapToResponseDto(blog);
    } catch (error) {
      this.logger.error("Error creating blog", error);
      throw error;
    }
  }

  /**
   * Get all blogs with optional filtering and pagination
   */
  async findAll(
    categoryName?: string,
    isPublished?: boolean,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    blogs: BlogListItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      // Try cache first
      const cacheKey = `blog:list:${categoryName || 'all'}:${isPublished ?? 'all'}:${page}:${limit}`;
      const cached = await this.cacheService.get<{
        blogs: BlogListItemDto[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(cacheKey);
      if (cached) return cached;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.BlogWhereInput = {};
      if (categoryName) {
        where.category = {
          name: categoryName,
        };
      }
      if (isPublished !== undefined) {
        where.isPublished = isPublished;
      }

      // Get blogs and total count
      const [blogs, total] = await Promise.all([
        this.prisma.blog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            category: true,
          },
        }),
        this.prisma.blog.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        blogs: blogs.map((blog) => this.mapToListItemDto(blog)),
        total,
        page,
        limit,
        totalPages,
      };

      // Cache result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error("Error fetching blogs", error);
      throw error;
    }
  }

  /**
   * Get a single blog by ID
   */
  async findOne(id: string): Promise<BlogResponseDto> {
    try {
      // Try cache first
      const cacheKey = `blog:id:${id}`;
      const cached = await this.cacheService.get<BlogResponseDto>(cacheKey);
      if (cached) return cached;

      const blog = await this.prisma.blog.findUnique({
        where: { id },
        include: {
          category: true,
        },
      });

      if (!blog) {
        throw new NotFoundException(`Blog with ID "${id}" not found`);
      }

      const result = this.mapToResponseDto(blog);
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching blog ${id}`, error);
      throw error;
    }
  }

  /**
   * Get a single blog by slug
   * Returns formatted response for blog details page
   */
  async findBySlug(slug: string): Promise<BlogDetailsResponseDto> {
    try {
      // Try cache first
      const cacheKey = `blog:slug:${slug}`;
      const cached = await this.cacheService.get<BlogDetailsResponseDto>(cacheKey);
      // Ensure cached data has isPublished field (for backward compatibility with old cache)
      if (cached) {
        // If cached data doesn't have isPublished, fetch fresh data
        if (cached.isPublished === undefined) {
          this.logger.warn(`Cached blog data missing isPublished field, fetching fresh data for slug: ${slug}`);
        } else {
          return cached;
        }
      }

      const blog = await this.prisma.blog.findUnique({
        where: { slug },
        include: {
          category: true,
        },
      });

      if (!blog) {
        throw new NotFoundException(`Blog with slug "${slug}" not found`);
      }

      const result = this.mapToDetailsResponseDto(blog);
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error fetching blog with slug ${slug}`, error);
      throw error;
    }
  }

  /**
   * Update a blog post
   */
  async update(
    id: string,
    updateBlogDto: UpdateBlogDto
  ): Promise<BlogResponseDto> {
    try {
      // Check if blog exists
      const existingBlog = await this.prisma.blog.findUnique({
        where: { id },
      });

      if (!existingBlog) {
        throw new NotFoundException(`Blog with ID "${id}" not found`);
      }

      // Check if slug is being updated and if it already exists
      if (updateBlogDto.slug && updateBlogDto.slug !== existingBlog.slug) {
        const slugExists = await this.prisma.blog.findUnique({
          where: { slug: updateBlogDto.slug },
        });

        if (slugExists) {
          throw new BadRequestException(
            `Blog with slug "${updateBlogDto.slug}" already exists`
          );
        }
      }

      // Prepare update data
      const data: Prisma.BlogUpdateInput = {};

      if (updateBlogDto.title !== undefined) {
        data.title = updateBlogDto.title;
      }
      if (updateBlogDto.slug !== undefined) {
        data.slug = updateBlogDto.slug;
      }
      if (updateBlogDto.category !== undefined) {
        // Find category by name
        const category = await this.prisma.blogCategory.findFirst({
          where: { name: updateBlogDto.category.trim() },
        });

        if (!category) {
          throw new BadRequestException(
            `Blog category "${updateBlogDto.category}" not found. Please create it first.`
          );
        }

        data.category = {
          connect: { id: category.id },
        };
      }
      if (updateBlogDto.imageUrl !== undefined) {
        data.imageUrl = updateBlogDto.imageUrl;
      }
      if (updateBlogDto.excerpt !== undefined) {
        data.excerpt = updateBlogDto.excerpt;
      }
      if (updateBlogDto.readTime !== undefined) {
        data.readTime = updateBlogDto.readTime;
      }
      if (updateBlogDto.contentSections !== undefined) {
        data.contentSections =
          updateBlogDto.contentSections as unknown as Prisma.InputJsonValue;
      }
      if (updateBlogDto.createdBy !== undefined) {
        data.createdBy = updateBlogDto.createdBy;
      }

      // Handle published status
      if (updateBlogDto.isPublished !== undefined) {
        data.isPublished = updateBlogDto.isPublished;
      }

      const blog = await this.prisma.blog.update({
        where: { id },
        data,
        include: {
          category: true,
        },
      });

      this.logger.log(`Blog updated: ${id} - ${blog.title}`);

      // Invalidate cache
      await this.cacheService.invalidateBlogCache();

      return this.mapToResponseDto(blog);
    } catch (error) {
      this.logger.error(`Error updating blog ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete a blog post
   */
  async remove(id: string): Promise<void> {
    try {
      const blog = await this.prisma.blog.findUnique({
        where: { id },
      });

      if (!blog) {
        throw new NotFoundException(`Blog with ID "${id}" not found`);
      }

      await this.prisma.blog.delete({
        where: { id },
      });

      // Invalidate cache
      await this.cacheService.invalidateBlogCache();

      this.logger.log(`Blog deleted: ${id} - ${blog.title}`);
    } catch (error) {
      this.logger.error(`Error deleting blog ${id}`, error);
      throw error;
    }
  }

  /**
   * Get blog categories with count (only published blogs)
   */
  async getCategories(): Promise<
    Array<{ category: { id: number; name: string }; count: number }>
  > {
    try {
      // Try cache first
      const cacheKey = 'blog:categories:withcount:published';
      const cached = await this.cacheService.get<Array<{ category: { id: number; name: string }; count: number }>>(cacheKey);
      if (cached) return cached;

      const categories = await this.prisma.blogCategory.findMany({
        include: {
          _count: {
            select: { 
              blogs: {
                where: {
                  isPublished: true, // Only count published blogs
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const result = categories.map((cat) => ({
        category: { id: cat.id, name: cat.name },
        count: cat._count.blogs,
      }));

      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error("Error fetching categories", error);
      throw error;
    }
  }

  /**
   * Create a simple blog category (just name, auto-generate slug)
   */
  async createCategorySimple(
    categoryName: string
  ): Promise<{ id: number; name: string }> {
    try {
      const name = categoryName.trim();

      // Generate slug from category name
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Check if category already exists
      const existing = await this.prisma.blogCategory.findFirst({
        where: {
          OR: [{ name: name }, { slug: slug }],
        },
      });

      if (existing) {
        throw new BadRequestException(`Blog category "${name}" already exists`);
      }

      const category = await this.prisma.blogCategory.create({
        data: {
          name: name,
          slug: slug,
        },
        select: {
          id: true,
          name: true,
        },
      });

      this.logger.log(
        `Blog category created: ${category.name} (ID: ${category.id})`
      );

      // Invalidate cache
      await this.cacheService.invalidateBlogCache();

      return category;
    } catch (error) {
      this.logger.error(
        `Error creating blog category: ${error.message}`,
        error.stack
      );
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

      const existing = await this.prisma.blogCategory.findFirst({
        where: {
          OR: [{ name: defaultName }, { slug: defaultSlug }],
        },
      });

      if (!existing) {
        await this.prisma.blogCategory.create({
          data: {
            name: defaultName,
            slug: defaultSlug,
          },
        });
        this.logger.log('Default "General" blog category created');
        // Invalidate cache after creating default category
        await this.cacheService.invalidateBlogCache();
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
   * Get all blog categories (for dropdown)
   */
  async findAllCategoriesForDropdown(): Promise<
    { id: number; name: string }[]
  > {
    try {
      // Ensure default category exists
      await this.ensureDefaultCategory();

      // Try cache first
      const cacheKey = 'blog:categories:dropdown';
      const cached = await this.cacheService.get<{ id: number; name: string }[]>(cacheKey);
      if (cached) return cached;

      const categories = await this.prisma.blogCategory.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
        },
      });

      await this.cacheService.set(cacheKey, categories, this.CACHE_TTL);

      return categories;
    } catch (error) {
      this.logger.error(
        `Error fetching blog categories for dropdown: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Get all blog categories
   */
  async findAllCategories(): Promise<
    Array<{
      id: number;
      name: string;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    try {
      // Ensure default category exists
      await this.ensureDefaultCategory();

      // Try cache first
      const cacheKey = 'blog:categories:all';
      const cached = await this.cacheService.get<Array<{
        id: number;
        name: string;
        slug: string;
        createdAt: Date;
        updatedAt: Date;
      }>>(cacheKey);
      if (cached) return cached;

      const categories = await this.prisma.blogCategory.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.cacheService.set(cacheKey, categories, this.CACHE_TTL);

      return categories;
    } catch (error) {
      this.logger.error(
        `Error fetching blog categories: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Update a blog category
   */
  async updateCategory(
    id: number,
    updateCategoryDto: UpdateBlogCategoryDto,
  ): Promise<{ id: number; name: string }> {
    try {
      // Check if category exists
      const existingCategory = await this.prisma.blogCategory.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        throw new NotFoundException(`Blog category with ID "${id}" not found`);
      }

      const updateData: any = {};

      // If category name is provided, update it and regenerate slug
      if (updateCategoryDto.category) {
        const name = updateCategoryDto.category.trim();
        const slug = name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");

        // Check if new name or slug already exists (excluding current category)
        const existing = await this.prisma.blogCategory.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              {
                OR: [{ name: name }, { slug: slug }],
              },
            ],
          },
        });

        if (existing) {
          throw new BadRequestException(
            `Blog category "${name}" already exists`,
          );
        }

        updateData.name = name;
        updateData.slug = slug;
      }

      const category = await this.prisma.blogCategory.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
        },
      });

      this.logger.log(
        `Blog category updated: ${category.name} (ID: ${category.id})`,
      );

      // Invalidate cache
      await this.cacheService.invalidateBlogCache();

      return category;
    } catch (error) {
      this.logger.error(
        `Error updating blog category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a blog category
   * Automatically reassigns blogs to "General" category if category is in use
   */
  async removeCategory(id: number): Promise<void> {
    try {
      const category = await this.prisma.blogCategory.findUnique({
        where: { id },
        include: {
          _count: {
            select: { blogs: true },
          },
        },
      });

      if (!category) {
        throw new NotFoundException(`Blog category with ID "${id}" not found`);
      }

      // If category has blogs, reassign them to "General" category
      if (category._count.blogs > 0) {
        // Find or create "General" category
        let generalCategory = await this.prisma.blogCategory.findFirst({
          where: {
            OR: [{ name: 'General' }, { slug: 'general' }],
          },
        });

        if (!generalCategory) {
          // Create "General" category if it doesn't exist
          generalCategory = await this.prisma.blogCategory.create({
            data: {
              name: 'General',
              slug: 'general',
            },
          });
          this.logger.log('Default "General" blog category created during deletion');
        }

        // Reassign all blogs from this category to "General"
        await this.prisma.blog.updateMany({
          where: { categoryId: id },
          data: { categoryId: generalCategory.id },
        });

        this.logger.log(
          `Reassigned ${category._count.blogs} blog(s) from category "${category.name}" to "General"`,
        );
      }

      // Now safe to delete the category
      await this.prisma.blogCategory.delete({
        where: { id },
      });

      this.logger.log(`Blog category deleted: ${category.name} (ID: ${id})`);

      // Invalidate cache
      await this.cacheService.invalidateBlogCache();
    } catch (error) {
      this.logger.error(
        `Error deleting blog category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Format date to readable string (e.g., "December 27, 2024")
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  /**
   * Map Prisma Blog model to BlogResponseDto
   */
  private mapToResponseDto(blog: any): BlogResponseDto {
    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      category:
        blog.category?.name ||
        (typeof blog.category === "string" ? blog.category : ""),
      imageUrl: blog.imageUrl,
      excerpt: blog.excerpt || undefined,
      readTime: blog.readTime,
      isPublished: blog.isPublished,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
      createdBy: blog.createdBy || undefined,
      contentSections: blog.contentSections as any,
    };
  }

  /**
   * Map Prisma Blog model to BlogListItemDto (for list page)
   */
  private mapToListItemDto(blog: any): BlogListItemDto {
    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      imageUrl: blog.imageUrl,
      category:
        blog.category?.name ||
        (typeof blog.category === "string" ? blog.category : ""),
      createdAt: this.formatDate(blog.createdAt),
      publishedDate: this.formatDate(blog.createdAt),
      readTime: blog.readTime,
      isPublished: blog.isPublished,
    };
  }

  /**
   * Map Prisma Blog model to BlogDetailsResponseDto (for details page)
   * Structure: Title -> Image -> Array of content sections
   */
  private mapToDetailsResponseDto(blog: any): BlogDetailsResponseDto {
    const contentSections = (blog.contentSections as any[]) || [];

    // Transform content sections to match frontend structure
    const formattedSections = contentSections.map((section) => ({
      title: section.title || "",
      description: section.description || "",
      imageUrl: section.imageUrl || undefined,
    }));

    return {
      id: blog.id,
      title: blog.title,
      imageUrl: blog.imageUrl,
      category:
        blog.category?.name ||
        (typeof blog.category === "string" ? blog.category : ""),
      slug: blog.slug,
      excerpt: blog.excerpt || undefined,
      readTime: blog.readTime,
      publishedDate: this.formatDate(blog.createdAt),
      createdAt: this.formatDate(blog.createdAt),
      isPublished: blog.isPublished ?? false, // Ensure isPublished is always included (default to false if undefined)
      contentSections: formattedSections,
    };
  }
}
