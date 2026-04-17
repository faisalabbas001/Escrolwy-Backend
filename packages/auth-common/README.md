# @escrowly/auth-common

Shared authentication guards and decorators for Escrowly microservices.

## Installation

```bash
# From the monorepo root
npm install

# Build the package
cd packages/auth-common
npm run build
```

## Quick Start

There are two approaches to implement authentication:

### Approach 1: Global Guards (Recommended)

Apply guards globally for consistent protection across all routes.

**Step 1: Import the Module**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthCommonModule } from '@escrowly/auth-common';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthCommonModule,
  ],
})
export class AppModule {}
```

**Step 2: Apply Guards Globally**
```typescript
// main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '@escrowly/auth-common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);

  // Apply guards globally (order matters: JWT first, then Roles)
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, configService),
    new RolesGuard(reflector),
  );

  await app.listen(3000);
}
bootstrap();
```

**Step 3: Use Decorators in Controllers**
```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Public, Roles, CurrentUser, Role, AuthUser } from '@escrowly/auth-common';

@Controller('escrows')
export class EscrowController {

  // Public route - no authentication required
  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }

  // Authenticated route - any authenticated user (no @Roles needed)
  @Get('my-escrows')
  getMyEscrows(@CurrentUser() user: AuthUser) {
    return this.escrowService.getUserEscrows(user.id);
  }

  // Role-restricted route - only specific roles
  @Roles(Role.USER)
  @Post()
  createEscrow(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEscrowDto,
  ) {
    return this.escrowService.create(dto, userId);
  }

  // Admin only route
  @Roles(Role.SUPER_ADMIN)
  @Get('all')
  getAllEscrows() {
    return this.escrowService.findAll();
  }
}
```

### Approach 2: Route-level Guards with @Auth()

For more granular control, apply guards at route level using the `@Auth()` decorator.

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Auth, AdminOnly, CurrentUser, Role, AuthUser } from '@escrowly/auth-common';

@Controller('escrows')
export class EscrowController {

  // Public route - no decorator needed
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }

  // Authenticated route - any authenticated user
  @Auth()
  @Get('my-escrows')
  getMyEscrows(@CurrentUser() user: AuthUser) {
    return this.escrowService.getUserEscrows(user.id);
  }

  // Role-restricted route
  @Auth(Role.USER)
  @Post()
  createEscrow(@CurrentUser('id') userId: string) {}

  // Admin only (shorthand)
  @AdminOnly()
  @Get('all')
  getAllEscrows() {}
}
```

## API Reference

### Guards

#### `JwtAuthGuard`
Validates JWT access tokens from the Authorization header.

- Expects: `Authorization: Bearer <token>`
- Verifies token signature, issuer, audience, and expiration
- Attaches user to `request.user`
- Respects `@Public()` decorator

#### `RolesGuard`
Enforces role-based access control.

- **Must run after** `JwtAuthGuard`
- Checks user role against `@Roles()` decorator
- If no `@Roles()` specified, allows any authenticated user
- Respects `@Public()` decorator

### Decorators

#### `@Public()`
Marks a route as public, bypassing authentication.

```typescript
@Public()
@Get('health')
healthCheck() {}
```

#### `@Roles(...roles)`
Restricts access to specific roles. Use with global guards.

```typescript
@Roles(Role.SUPER_ADMIN)
@Roles('super-admin', 'staff-website')
@Roles(Role.USER, Role.SUPER_ADMIN)
```

#### `@CurrentUser(property?)`
Extracts the authenticated user from the request.

```typescript
// Full user object
@CurrentUser() user: AuthUser

// Specific property
@CurrentUser('id') userId: string
@CurrentUser('email') email: string
@CurrentUser('role') role: string
```

#### `@Auth(...roles)` (Route-level)
Combined decorator for route-level protection. Don't use with global guards.

```typescript
@Auth()                          // Any authenticated user
@Auth(Role.USER)                 // Specific role
@Auth(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)  // Multiple roles
```

#### `@RequireAuth()` (Route-level)
Authentication only, no role check. Don't use with global guards.

#### `@AdminOnly()` (Route-level)
Shorthand for `@Auth(Role.SUPER_ADMIN)`.

#### `@StaffOnly()` (Route-level)
Shorthand for `@Auth(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)`.

### Interfaces

#### `AuthUser`
```typescript
interface AuthUser {
  id: string;        // User ID
  email: string;     // User email
  role: Role | string;  // User role
  sessionId: string; // Session ID
}
```

#### `Role`
```typescript
enum Role {
  USER = 'user',
  SUPER_ADMIN = 'super-admin',
  STAFF_WEBSITE = 'staff-website',
}
```

#### `JwtPayload`
```typescript
interface JwtPayload {
  sub: string;      // User ID
  email: string;
  role: string;
  sessionId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
```

## Configuration

The guards use the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT verification | `default-secret-change-me` |
| `JWT_ISSUER` | Expected token issuer | `escrowly-auth` |
| `JWT_AUDIENCE` | Expected token audience | `escrowly` |

## Best Practices

### 1. Use Global Guards for Consistent Protection
Apply `JwtAuthGuard` and `RolesGuard` globally in `main.ts` to ensure all routes are protected by default.

### 2. Mark Public Routes Explicitly
Use `@Public()` decorator for routes that should be accessible without authentication (health checks, public data).

### 3. Use @Roles() for Role-Based Access
When using global guards, use `@Roles()` decorator to restrict access to specific roles.

### 4. Get Current User with @CurrentUser()
Always use `@CurrentUser()` decorator to get the authenticated user instead of accessing `request.user` directly.

### 5. Order Matters
When applying guards, `JwtAuthGuard` must run before `RolesGuard`:
```typescript
app.useGlobalGuards(
  new JwtAuthGuard(reflector, configService),  // First: authenticate
  new RolesGuard(reflector),                    // Second: authorize
);
```

## License

MIT
