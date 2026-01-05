# Admin Service - Complete Code Explanation

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Entry Point (main.ts)](#entry-point-maints)
3. [Application Module (app.module.ts)](#application-module-appmodulets)
4. [Database Layer (Prisma)](#database-layer-prisma)
5. [Blog Module](#blog-module)
6. [Help Desk Module](#help-desk-module)
7. [Upload Module](#upload-module)
8. [Health Check Module](#health-check-module)

---

## Architecture Overview

The Admin Service is a **NestJS microservice** that handles administrative operations for the Escrowly platform. It follows a **modular architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         main.ts (Bootstrap)             │
│  - Creates NestJS app                   │
│  - Configures middleware                │
│  - Sets up Swagger docs                 │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      app.module.ts (Root Module)         │
│  - Imports all feature modules          │
│  - Configures global services           │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│ Blog  │ │ Help  │ │Upload │
│Module │ │Desk   │ │Module │
└───────┘ └───────┘ └───────┘
```

---

## Entry Point (main.ts)

**Purpose**: Bootstrap the NestJS application and configure all global settings.

### Line-by-Line Explanation

```typescript
import { NestFactory } from '@nestjs/core';
```
- **Purpose**: Import NestFactory to create the NestJS application instance
- **What it does**: Creates the application container

```typescript
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
```
- **ValidationPipe**: Automatically validates incoming request data
- **Logger**: Provides logging functionality
- **VersioningType**: Enables API versioning

```typescript
import { ConfigService } from '@nestjs/config';
```
- **Purpose**: Access environment variables and configuration
- **What it does**: Reads from `.env` file or environment

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
```
- **Purpose**: Generate API documentation
- **What it does**: Creates interactive Swagger UI at `/api/docs`

```typescript
async function bootstrap() {
```
- **Purpose**: Main bootstrap function that starts the application
- **Why async**: Database connections and app initialization are asynchronous

```typescript
const logger = new Logger('Bootstrap');
```
- **Purpose**: Create a logger instance for startup messages
- **What it logs**: Application startup, errors, configuration

```typescript
const app = await NestFactory.create(AppModule, {
  logger: ['log', 'error', 'warn', 'debug', 'verbose'],
});
```
- **Purpose**: Create the NestJS application instance
- **What it does**: 
  - Loads `AppModule` (root module)
  - Configures logging levels
  - Initializes dependency injection container

```typescript
const configService = app.get(ConfigService);
const port = configService.get<number>('PORT', 3002);
```
- **Purpose**: Get configuration service and read port number
- **Default**: Port 3002 if not specified in environment
- **Why**: Allows flexible deployment (dev/staging/prod can use different ports)

```typescript
app.enableCors({
  origin: true,
  credentials: true,
});
```
- **Purpose**: Enable Cross-Origin Resource Sharing (CORS)
- **origin: true**: Allows requests from any origin (configure for production)
- **credentials: true**: Allows cookies/auth headers in requests

```typescript
app.setGlobalPrefix('api');
```
- **Purpose**: All routes will be prefixed with `/api`
- **Example**: `/admin/blogs` becomes `/api/v1/admin/blogs`
- **Why**: Organizes API endpoints and allows versioning

```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```
- **Purpose**: Enable API versioning via URL path
- **Example**: `/api/v1/admin/blogs` or `/api/v2/admin/blogs`
- **Why**: Allows breaking changes without breaking existing clients

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```
- **whitelist: true**: Removes properties not defined in DTOs
- **forbidNonWhitelisted: true**: Throws error if extra properties are sent
- **transform: true**: Converts plain objects to DTO instances
- **enableImplicitConversion: true**: Automatically converts string numbers to numbers

**Example**:
```typescript
// Request: { title: "Blog", page: "1" }
// After transform: { title: "Blog", page: 1 } // page is now number
```

```typescript
if (nodeEnv !== 'production') {
  const config = new DocumentBuilder()
    .setTitle('Escrowly Admin Service')
    .setDescription('...')
    .setVersion('1.0')
    .addTag('admin', 'Administration endpoints')
    .addBearerAuth({...}, 'JWT-auth')
    .build();
```
- **Purpose**: Configure Swagger documentation (only in non-production)
- **What it does**: 
  - Sets API title and description
  - Adds tags for grouping endpoints
  - Configures JWT authentication for testing

```typescript
SwaggerModule.setup('api/docs', app, document);
```
- **Purpose**: Mount Swagger UI at `/api/docs`
- **What it does**: Creates interactive API documentation interface

```typescript
app.enableShutdownHooks();
```
- **Purpose**: Enable graceful shutdown
- **What it does**: Allows app to close database connections properly when stopped

```typescript
await app.listen(port);
```
- **Purpose**: Start the HTTP server
- **What it does**: Listens on specified port for incoming requests

---

## Application Module (app.module.ts)

**Purpose**: Root module that imports all feature modules and configures global services.

### Line-by-Line Explanation

```typescript
@Module({
  imports: [...],
  controllers: [AppController],
  providers: [AppService],
})
```
- **@Module**: Decorator that marks this class as a NestJS module
- **imports**: Modules this module depends on
- **controllers**: HTTP request handlers
- **providers**: Services that can be injected

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env',
  cache: true,
})
```
- **isGlobal: true**: Makes ConfigService available in all modules without importing
- **envFilePath: '.env'**: Loads environment variables from `.env` file
- **cache: true**: Caches environment variables for performance

```typescript
SecretsModule,
```
- **Purpose**: Imports shared secrets management module
- **What it does**: Provides `SecretsService` for AWS Secrets Manager integration
- **Why**: Centralized secrets management across all services

```typescript
PrismaModule,
```
- **Purpose**: Database connection module
- **What it does**: Provides `PrismaService` for database operations
- **@Global()**: Makes it available in all modules without importing

```typescript
BlogModule,
HelpDeskModule,
UploadModule,
HealthModule,
```
- **Purpose**: Feature modules for different functionalities
- **What they do**: Each module handles a specific domain (blogs, help desk, etc.)

---

## Database Layer (Prisma)

### PrismaModule (prisma.module.ts)

**Purpose**: Configures database connection with dynamic credentials from AWS Secrets Manager.

```typescript
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (secretsService: SecretsService) => {
        const dbUrl = await secretsService.getDatabaseUrl();
        process.env.DATABASE_URL = dbUrl;
        return new PrismaService(secretsService);
      },
      inject: [SecretsService],
    },
  ],
})
```

**Line-by-Line**:

```typescript
@Global()
```
- **Purpose**: Makes PrismaService available in all modules
- **Why**: Database is used everywhere, so we don't want to import it in every module

```typescript
useFactory: async (secretsService: SecretsService) => {
```
- **Purpose**: Factory function that creates PrismaService instance
- **Why async**: Fetching database credentials is asynchronous

```typescript
const dbUrl = await secretsService.getDatabaseUrl();
```
- **Purpose**: Get database connection string with credentials
- **What it does**: 
  - In dev: Reads from `.env` file
  - In prod: Fetches from AWS Secrets Manager
  - Replaces placeholders (USERNAME, PASSWORD) with actual credentials

```typescript
process.env.DATABASE_URL = dbUrl;
```
- **Purpose**: Set environment variable for Prisma
- **Why**: PrismaClient reads `DATABASE_URL` from `process.env` when connecting

### PrismaService (prisma.service.ts)

**Purpose**: Wraps PrismaClient and manages database connection lifecycle.

```typescript
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
```
- **extends PrismaClient**: Inherits all Prisma database methods
- **OnModuleInit**: Lifecycle hook - runs when module initializes
- **OnModuleDestroy**: Lifecycle hook - runs when module is destroyed

```typescript
constructor(private readonly secretsService: SecretsService) {
  super({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
    ],
  });
}
```
- **Purpose**: Configure PrismaClient logging
- **emit: 'event'**: Logs are emitted as events (not console.log)
- **level: 'query'**: Log all SQL queries
- **level: 'error'**: Log database errors

```typescript
if (process.env.NODE_ENV === 'development') {
  this.$on('query' as never, (e: any) => {
    this.logger.debug(`Query: ${e.query}`);
    this.logger.debug(`Duration: ${e.duration}ms`);
  });
}
```
- **Purpose**: Log SQL queries in development mode only
- **What it logs**: 
  - SQL query text
  - Query execution time
- **Why**: Helps debug performance issues

```typescript
async onModuleInit() {
  await this.$connect();
  this.logger.log('✅ Connected to PostgreSQL');
}
```
- **Purpose**: Connect to database when module initializes
- **When**: Runs automatically when NestJS starts
- **What it does**: Establishes connection pool to PostgreSQL

```typescript
async onModuleDestroy() {
  await this.$disconnect();
}
```
- **Purpose**: Disconnect from database when app shuts down
- **Why**: Prevents connection leaks and ensures graceful shutdown

---

## Blog Module

### BlogService (blog.service.ts)

**Purpose**: Contains all business logic for blog operations.

#### Create Blog Method

```typescript
async create(createBlogDto: CreateBlogDto): Promise<BlogResponseDto> {
  // Check if slug already exists
  const existingBlog = await this.prisma.blog.findUnique({
    where: { slug: createBlogDto.slug },
  });
```
- **Purpose**: Check for duplicate slugs before creating
- **Why**: Slugs must be unique (used in URLs)
- **findUnique**: Prisma method for finding by unique field

```typescript
if (existingBlog) {
  throw new BadRequestException(
    `Blog with slug "${createBlogDto.slug}" already exists`,
  );
}
```
- **Purpose**: Prevent duplicate slugs
- **BadRequestException**: HTTP 400 error

```typescript
const data: Prisma.BlogCreateInput = {
  title: createBlogDto.title,
  slug: createBlogDto.slug,
  category: createBlogDto.category,
  contentSections: createBlogDto.contentSections as unknown as Prisma.InputJsonValue,
};
```
- **Purpose**: Prepare data for database insertion
- **Prisma.BlogCreateInput**: Type-safe input type from Prisma
- **as unknown as Prisma.InputJsonValue**: Type assertion for JSON field

```typescript
const blog = await this.prisma.blog.create({ data });
return this.mapToResponseDto(blog);
```
- **Purpose**: Create blog in database and return formatted response
- **mapToResponseDto**: Transforms database model to API response format

#### Find All Blogs Method

```typescript
async findAll(
  category?: BlogCategory,
  isPublished?: boolean,
  page: number = 1,
  limit: number = 10,
)
```
- **Purpose**: Get paginated list of blogs with optional filters
- **category**: Filter by blog category
- **isPublished**: Filter by publication status
- **page, limit**: Pagination parameters

```typescript
const skip = (page - 1) * limit;
const where: Prisma.BlogWhereInput = {};
if (category) {
  where.category = category;
}
```
- **skip**: Number of records to skip (for pagination)
- **where**: Prisma filter object
- **Example**: Page 2 with limit 10 → skip 10 records

```typescript
const [blogs, total] = await Promise.all([
  this.prisma.blog.findMany({ where, skip, take: limit }),
  this.prisma.blog.count({ where }),
]);
```
- **Purpose**: Fetch blogs and total count in parallel
- **Promise.all**: Executes both queries simultaneously (faster)
- **findMany**: Get multiple records
- **count**: Get total number of matching records

### BlogController (blog.controller.ts)

**Purpose**: Handles HTTP requests and routes them to service methods.

```typescript
@Controller({
  path: 'admin/blogs',
  version: '1',
})
```
- **Purpose**: Define base route for all blog endpoints
- **path**: All routes will be `/api/v1/admin/blogs/*`
- **version**: API version (v1)

```typescript
@Post()
@ApiOperation({ summary: 'Create a new blog post' })
@ApiResponse({ status: 201, description: 'Blog created successfully' })
async create(@Body() createBlogDto: CreateBlogDto): Promise<BlogResponseDto> {
  return this.blogService.create(createBlogDto);
}
```
- **@Post()**: HTTP POST method handler
- **@Body()**: Extracts request body and validates against CreateBlogDto
- **@ApiOperation**: Swagger documentation
- **@ApiResponse**: Documents possible responses

```typescript
@Get()
@ApiQuery({ name: 'category', required: false, enum: BlogCategory })
async findAll(
  @Query('category', new ParseEnumPipe(BlogCategory, { optional: true }))
  category?: BlogCategory,
  @Query('published', new DefaultValuePipe(undefined))
  isPublished?: boolean,
)
```
- **@Get()**: HTTP GET method handler
- **@Query()**: Extracts query parameters from URL
- **ParseEnumPipe**: Validates that category is a valid BlogCategory enum value
- **DefaultValuePipe**: Sets default value if parameter is missing

**Example Request**:
```
GET /api/v1/admin/blogs?category=CRYPTO_ESCROW&published=true&page=1&limit=10
```

---

## Help Desk Module

### HelpDeskService (help-desk.service.ts)

**Purpose**: Manages help desk categories and questions.

#### Create Category Method

```typescript
async createCategory(createCategoryDto: CreateCategoryDto) {
  // Check if slug already exists
  const existingCategory = await this.prisma.helpCategory.findUnique({
    where: { slug: createCategoryDto.slug },
  });
```
- **Purpose**: Validate slug uniqueness
- **helpCategory**: Prisma model for categories table

```typescript
const category = await this.prisma.helpCategory.create({
  data: {
    title: createCategoryDto.title,
    slug: createCategoryDto.slug,
  },
  include: {
    _count: {
      select: { questions: true },
    },
  },
});
```
- **Purpose**: Create category and include question count
- **include**: Prisma method to include related data
- **_count**: Prisma feature to count related records
- **select: { questions: true }**: Count questions in this category

#### Get Category by Slug with Questions

```typescript
async findCategoryBySlug(slug: string): Promise<CategoryWithQuestionsDto> {
  const category = await this.prisma.helpCategory.findUnique({
    where: { slug },
    include: {
      questions: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { questions: true },
      },
    },
  });
```
- **Purpose**: Get category with all its questions
- **include.questions**: Include related questions
- **orderBy**: Sort questions by creation date (newest first)

#### Create Question Method

```typescript
async createQuestion(createQuestionDto: CreateQuestionDto) {
  // Verify category exists
  const category = await this.prisma.helpCategory.findUnique({
    where: { id: createQuestionDto.categoryId },
  });
```
- **Purpose**: Validate that category exists before creating question
- **Why**: Prevents orphaned questions (questions without valid category)

```typescript
if (!category) {
  throw new NotFoundException(
    `Category with ID ${createQuestionDto.categoryId} not found`,
  );
}
```
- **Purpose**: Return 404 if category doesn't exist
- **NotFoundException**: HTTP 404 error

```typescript
const question = await this.prisma.helpQuestion.create({
  data: {
    question: createQuestionDto.question,
    answer: createQuestionDto.answer,
    slug: createQuestionDto.slug,
    categoryId: createQuestionDto.categoryId,
  },
  include: {
    category: true,
  },
});
```
- **Purpose**: Create question linked to category
- **include.category**: Include full category object in response
- **Why**: Frontend needs category info when displaying question

---

## Upload Module

### S3Service (s3.service.ts)

**Purpose**: Handles image uploads to AWS S3.

```typescript
async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
  const s3Client = new S3Client({
    region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
  });
```
- **Purpose**: Create AWS S3 client
- **Express.Multer.File**: Type for uploaded file from multer middleware
- **folder**: S3 folder path (e.g., 'escrowly-blogs')

```typescript
const key = `${folder}/${Date.now()}-${file.originalname}`;
```
- **Purpose**: Generate unique file name
- **Date.now()**: Timestamp to ensure uniqueness
- **Why**: Prevents file name conflicts

```typescript
const command = new PutObjectCommand({
  Bucket: bucketName,
  Key: key,
  Body: file.buffer,
  ContentType: file.mimetype,
});
```
- **Purpose**: Prepare S3 upload command
- **Bucket**: S3 bucket name
- **Key**: File path in S3
- **Body**: File content (buffer)
- **ContentType**: MIME type (e.g., 'image/jpeg')

```typescript
await s3Client.send(command);
return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
```
- **Purpose**: Upload file and return public URL
- **Why**: Frontend needs URL to display image

---

## Health Check Module

**Purpose**: Provides endpoints to check service health.

```typescript
@Get()
async check() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'admin-service',
  };
}
```
- **Purpose**: Simple health check endpoint
- **Use case**: Load balancers, monitoring tools
- **Returns**: Service status and timestamp

---

## Data Flow Example: Creating a Blog

```
1. HTTP Request
   POST /api/v1/admin/blogs
   Body: { title: "My Blog", slug: "my-blog", ... }

2. BlogController.create()
   - Receives request
   - Validates body against CreateBlogDto
   - Calls blogService.create()

3. BlogService.create()
   - Checks if slug exists
   - Prepares data
   - Calls prisma.blog.create()

4. PrismaService
   - Executes SQL: INSERT INTO blog ...
   - Returns created blog record

5. BlogService
   - Maps database model to BlogResponseDto
   - Returns formatted response

6. BlogController
   - Returns HTTP 201 with blog data
```

---

## Key Concepts

### Dependency Injection
```typescript
constructor(private readonly prisma: PrismaService) {}
```
- **Purpose**: NestJS automatically injects PrismaService
- **Why**: Makes code testable and maintainable
- **How**: NestJS container manages service instances

### DTOs (Data Transfer Objects)
```typescript
export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
```
- **Purpose**: Define structure of incoming/outgoing data
- **@IsString()**: Validation decorator (from class-validator)
- **Why**: Ensures data integrity and type safety

### Prisma Queries
```typescript
await this.prisma.blog.findMany({
  where: { isPublished: true },
  skip: 0,
  take: 10,
  orderBy: { createdAt: 'desc' },
});
```
- **where**: Filter conditions (WHERE clause)
- **skip/take**: Pagination (OFFSET/LIMIT)
- **orderBy**: Sorting (ORDER BY)

---

## Environment Variables

```env
PORT=3002                    # Server port
NODE_ENV=development         # Environment (dev/stage/prod)
DATABASE_URL=postgresql://... # Database connection (with placeholders)
DB_SECRET_ARN=arn:aws:...    # AWS Secrets Manager ARN for DB credentials
AWS_REGION=us-east-1         # AWS region
AWS_S3_BUCKET=escrowly-...   # S3 bucket name
```

---

## Summary

The Admin Service follows these principles:

1. **Modular Architecture**: Each feature is a separate module
2. **Separation of Concerns**: Controllers handle HTTP, Services handle business logic
3. **Type Safety**: TypeScript + Prisma ensure type safety
4. **Validation**: Automatic validation via DTOs and ValidationPipe
5. **Documentation**: Swagger/OpenAPI for API documentation
6. **Security**: AWS Secrets Manager for credentials
7. **Scalability**: Designed as microservice, can scale independently

This architecture makes the codebase:
- **Maintainable**: Clear structure, easy to find code
- **Testable**: Services can be tested independently
- **Scalable**: Can add new features as new modules
- **Secure**: Centralized secrets management
- **Documented**: Auto-generated API docs

