# API Documentation Standards - Swagger/OpenAPI Guidelines

## Overview

This document outlines the standards and best practices for implementing API documentation using Swagger/OpenAPI in the Escrowly Escrow Service. All developers must follow these rules to ensure consistency, maintainability, and clarity across the entire codebase.

---

## 1. Folder Structure

Every module must follow this folder structure for proper organization:

```
src/
├── modules/
│   ├── <module-name>/
│   │   ├── <module>.controller.ts
│   │   ├── <module>.service.ts
│   │   ├── <module>.module.ts
│   │   ├── dto/
│   │   │   ├── <entity>.dto.ts                 # Plain DTO classes
│   │   │   ├── <request>.dto.ts
│   │   │   ├── <response>.dto.ts
│   │   │   └── docs/
│   │   │       ├── <entity>.dto.docs.ts        # Documented DTOs with @ApiProperty
│   │   │       ├── <request>.dto.docs.ts
│   │   │       └── <response>.dto.docs.ts
│   │   └── docs/
│   │       ├── <module>.swagger.ts             # Endpoint decorators
│   │       └── <module>.tags.ts                # API tag decorators
│   │
│   └── <another-module>/
│       └── ...
│
├── common/
│   ├── decorators/
│   │   └── ... (shared decorators if any)
│   └── ... (other common utilities)
│
├── docs/
│   ├── swagger.config.ts                       # Swagger configuration
│   └── swagger.setup.ts                        # Swagger initialization
│
└── main.ts
```

---

## 2. DTO Organization

### 2.1 Plain DTOs (`.dto.ts`)

Plain DTOs contain class-validator decorators for request validation. These are used by the application for data validation and transformation:

```typescript
// src/modules/users/dto/create-user.dto.ts

import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;
}
```

**Purpose:**

- Used by NestJS ValidationPipe for request body validation
- Used for runtime type validation and data transformation
- Applied in controllers via body parameter
- Validation errors automatically return 400 Bad Request responses

**Key Decorators:**

- `@IsEmail()` - Validate email format
- `@IsString()` - Validate string type
- `@IsNumber()` - Validate number type
- `@IsBoolean()` - Validate boolean type
- `@MinLength(n)` - Minimum string length
- `@MaxLength(n)` - Maximum string length
- `@Min(n)` / `@Max(n)` - Number range
- `@IsOptional()` - Make field optional
- `@IsEnum(enum)` - Validate against enum values
- `@IsArray()` - Validate array type
- `@ArrayMinSize(n)` - Minimum array length
- `@Matches(regex)` - Regex validation
- `@Transform()` - Transform value before validation

### 2.2 Documented DTOs (`.dto.docs.ts`)

Documented DTOs include full Swagger/OpenAPI metadata using `@ApiProperty`:

```typescript
// src/modules/users/dto/docs/create-user.dto.docs.ts

import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDtoDocs {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    type: String,
  })
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    type: String,
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    type: String,
  })
  lastName: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+1234567890',
    type: String,
    required: false,
  })
  phone?: string;
}
```

**Key Points:**

- Every property must have `@ApiProperty`
- Always include `description` explaining the field
- Always include `example` with realistic data
- Always specify `type` explicitly
- Use `required: false` for optional fields
- Use `enum: [...]` for fields with specific values
- Use `isArray: true` for array properties

---

## 3. Swagger Decorators

### 3.1 Endpoint Decorators (`.swagger.ts`)

Create custom decorators for each endpoint using `applyDecorators`:

```typescript
// src/modules/users/docs/users.swagger.ts

import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateUserDtoDocs } from '../dto/docs/create-user.dto.docs';
import { UserResponseDtoDocs } from '../dto/docs/user-response.dto.docs';

/**
 * Decorator for Create User endpoint
 * POST /users
 */
export function ApiCreateUser() {
  return applyDecorators(
    HttpCode(201),
    ApiOperation({
      summary: 'Create a new user',
      description: 'Creates a new user account with the provided information',
    }),
    ApiResponse({
      status: 201,
      description: 'User created successfully',
      type: UserResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid input data',
    }),
    ApiResponse({
      status: 409,
      description: 'Email already exists',
    }),
  );
}

/**
 * Decorator for Get User endpoint
 * GET /users/:id
 */
export function ApiGetUser() {
  return applyDecorators(
    HttpCode(200),
    ApiOperation({
      summary: 'Get user by ID',
      description: 'Retrieves user information by their unique ID',
    }),
    ApiResponse({
      status: 200,
      description: 'User retrieved successfully',
      type: UserResponseDtoDocs,
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
    }),
  );
}
```

**Best Practices:**

- Create one decorator function per endpoint
- Include meaningful summary and description
- Document all possible response codes (200, 201, 400, 401, 403, 404, 409, 500, etc.)
- Use `HttpCode()` to specify the HTTP status code
- Always use documented DTOs (`.dto.docs.ts`), never inline schemas
- Include descriptive error messages for error responses

### 3.2 Tag Decorators (`.tags.ts`)

Create tag decorators to group related endpoints:

```typescript
// src/modules/users/docs/users.tags.ts

import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Tag decorator for Users API
 * Groups all user-related endpoints under a single tag in Swagger
 */
export function UsersApiTag() {
  return applyDecorators(ApiTags('users'));
}
```

**Best Practices:**

- One tag decorator per module
- Use lowercase, plural names (e.g., 'users', 'products', 'orders')
- Tag name should match the module name

---

## 4. Controller Implementation

Controllers must use custom decorators, NOT inline Swagger decorators:

```typescript
// src/modules/users/users.controller.ts

import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiCreateUser, ApiGetUser } from './docs/users.swagger';
import { UsersApiTag } from './docs/users.tags';
import { CreateUserDto } from './dto/create-user.dto';

/**
 * Users Controller
 *
 * Handles user-related endpoints
 */
@UsersApiTag()
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user
   */
  @ApiCreateUser()
  @Post()
  async createUser(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  /**
   * Get user by ID
   */
  @ApiGetUser()
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

**Key Rules:**

- ✅ Use plain DTOs (`.dto.ts`) with class-validator in `@Body()`, `@Query()`, `@Param()`
- ✅ Use custom decorators (`@ApiCreateUser()`, `@ApiGetUser()`)
- ✅ Import tag decorator (`@UsersApiTag()`)
- ✅ Add JSDoc comments above methods
- ❌ Never use swagger DTOs (`.dto.docs.ts`) in controller methods
- ❌ Never use inline `@ApiOperation()`, `@ApiResponse()`, or schema objects
- ❌ Never skip validation decorators on DTOs
- Version endpoints using `version` in controller decorator

---

## 5. Global Swagger Configuration

### 5.1 Swagger Config (`swagger.config.ts`)

```typescript
// src/docs/swagger.config.ts

import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Escrow Service API')
  .setDescription('API for managing escrow transactions and payments')
  .setVersion('1.0.0')
  .setContact({
    name: 'Escrowly Support',
    url: 'https://escrowly.com',
  })
  .setLicense('MIT', 'https://opensource.org/licenses/MIT')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'access_token',
  )
  .addTag('health', 'Health and readiness checks')
  .addTag('users', 'User management')
  .addTag('transactions', 'Transaction management')
  // Add more tags here as modules are created
  .build();
```

**Best Practices:**

- Keep configuration centralized
- Update tags as new modules are added
- Define API metadata (title, version, contact, license)

### 5.2 Swagger Setup (`swagger.setup.ts`)

```typescript
// src/docs/swagger.setup.ts

import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './swagger.config';

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: true,
      filter: true,
      showRequestHeaders: true,
      docExpansion: 'list',
    },
  });
}
```

### 5.3 Main Bootstrap (`main.ts`)

```typescript
// src/main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './docs/swagger.setup';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Setup Swagger documentation
  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Escrow service running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();
```

---

## 6. @ApiProperty Rules

When documenting DTOs, follow these rules for `@ApiProperty`:

### 6.1 Required Properties

```typescript
@ApiProperty({
  description: 'User email address',
  example: 'user@example.com',
  type: String,
})
email: string;
```

### 6.2 Optional Properties

```typescript
@ApiProperty({
  description: 'User middle name',
  example: 'Michael',
  type: String,
  required: false,
})
middleName?: string;
```

### 6.3 Enum Properties

```typescript
@ApiProperty({
  description: 'User role',
  example: 'admin',
  enum: ['admin', 'user', 'moderator'],
  enumName: 'UserRole',
})
role: string;
```

### 6.4 Array Properties

```typescript
@ApiProperty({
  description: 'List of user tags',
  example: ['vip', 'verified'],
  type: [String],
  isArray: true,
})
tags: string[];
```

### 6.5 Nested Objects

```typescript
import { ApiProperty } from '@nestjs/swagger';

class AddressDtoDocs {
  @ApiProperty({ example: '123 Main St' })
  street: string;

  @ApiProperty({ example: 'New York' })
  city: string;
}

export class UserDetailsDtoDocs {
  @ApiProperty({
    description: 'User address information',
    type: AddressDtoDocs,
  })
  address: AddressDtoDocs;
}
```

---

## 7. HTTP Status Codes

Always document all relevant HTTP status codes:

| Code | Meaning              | When to Use                         |
| ---- | -------------------- | ----------------------------------- |
| 200  | OK                   | GET, successful operations          |
| 201  | Created              | POST creating new resources         |
| 204  | No Content           | DELETE successful, no response body |
| 400  | Bad Request          | Invalid input data                  |
| 401  | Unauthorized         | Missing/invalid authentication      |
| 403  | Forbidden            | Authenticated but not authorized    |
| 404  | Not Found            | Resource doesn't exist              |
| 409  | Conflict             | Duplicate/conflicting resource      |
| 422  | Unprocessable Entity | Validation error                    |
| 500  | Server Error         | Unexpected server error             |

---

## 8. Example: Complete Module Implementation

Here's a complete example of a properly documented module:

### Directory Structure

```
src/modules/health/
├── health.controller.ts
├── health.service.ts
├── health.module.ts
├── dto/
│   ├── health-status.dto.ts
│   └── docs/
│       └── health-status.dto.docs.ts
└── docs/
    ├── health.swagger.ts
    └── health.tags.ts
```

### health.service.ts

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealthStatus() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
```

### health.controller.ts

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiHealthCheck } from './docs/health.swagger';
import { HealthCheckApiTag } from './docs/health.tags';

@HealthCheckApiTag()
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiHealthCheck()
  @Get()
  healthCheck() {
    return this.healthService.getHealthStatus();
  }
}
```

### health.swagger.ts

```typescript
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthStatusDtoDocs } from '../dto/docs/health-status.dto.docs';

export function ApiHealthCheck() {
  return applyDecorators(
    ApiOperation({
      summary: 'Health check',
      description: 'Check if service is healthy',
    }),
    ApiResponse({
      status: 200,
      description: 'Service is healthy',
      type: HealthStatusDtoDocs,
    }),
  );
}
```

### health.tags.ts

```typescript
import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export function HealthCheckApiTag() {
  return applyDecorators(ApiTags('health'));
}
```

### health-status.dto.docs.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDtoDocs {
  @ApiProperty({
    description: 'Health status',
    example: 'healthy',
  })
  status: string;

  @ApiProperty({
    description: 'Timestamp',
    example: '2025-12-11T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Process uptime in seconds',
    example: 3600,
    type: Number,
  })
  uptime: number;
}
```

---

## 9. Code Review Checklist

Before submitting a PR, ensure:

- ✅ DTOs are separated into plain (`.dto.ts`) and documented (`.dto.docs.ts`) files
- ✅ All properties in docs DTOs have `@ApiProperty` with description and example
- ✅ Endpoint documentation is in `.swagger.ts` using custom decorators
- ✅ Tags are defined in `.tags.ts` using decorator function
- ✅ Controllers use custom decorators, NOT inline Swagger annotations
- ✅ All HTTP response codes are documented
- ✅ No inline schemas or `@ApiResponse` with `schema` property
- ✅ Folder structure follows the standard layout
- ✅ JSDoc comments above controller methods
- ✅ Type annotations are explicit and complete
- ✅ Examples in `@ApiProperty` are realistic

---

## 10. Common Mistakes to Avoid

### ❌ WRONG: Inline Swagger in Controller

```typescript
@Get(':id')
@ApiOperation({ summary: 'Get user' })
@ApiResponse({
  status: 200,
  description: 'User found',
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
    },
  },
})
getUser(@Param('id') id: string) {}
```

### ✅ CORRECT: Custom Decorator

```typescript
@ApiGetUser()
@Get(':id')
getUser(@Param('id') id: string) {}
```

### ❌ WRONG: Missing @ApiProperty

```typescript
export class UserDtoDocs {
  id: string;
  email: string;
}
```

### ✅ CORRECT: Fully Documented

```typescript
export class UserDtoDocs {
  @ApiProperty({ example: 'uuid-123', type: String })
  id: string;

  @ApiProperty({ example: 'user@example.com', type: String })
  email: string;
}
```

---

## 11. Updating Swagger Config for New Modules

When creating a new module, add its tag to `swagger.config.ts`:

```typescript
.addTag('users', 'User management')
.addTag('transactions', 'Transaction management')
.addTag('payments', 'Payment processing')  // New module
```

---

## 12. Versioning Strategy

All endpoints should be versioned using URI versioning:

```typescript
@Controller({
  path: 'users',
  version: '1',  // Version 1
})
```

For backward compatibility with breaking changes:

```typescript
@Controller({
  path: 'users',
  version: ['1', '2'],  // Support both v1 and v2
})
```

---

## Summary

The key principles are:

1. **Separation of Concerns**: DTOs, swagger configs, and controllers are separate
2. **No Inline Documentation**: Always use custom decorators and documented DTOs
3. **Consistency**: Follow the folder structure and naming conventions
4. **Clarity**: Every property and endpoint must be clearly documented
5. **Maintainability**: Changes to documentation don't affect controller logic

---

**Last Updated:** December 11, 2025  
**Version:** 1.0.0  
**Maintained By:** Escrowly Development Team
