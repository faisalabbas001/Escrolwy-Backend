# Auth Service - Guards & Access Control Documentation

## Overview

The Auth Service uses a centralized guard system from the `@escrowly/auth-common` shared package. This ensures consistent access control across all microservices.

---

## Guard Files Used

### ✅ Guards FROM Shared Package (`@escrowly/auth-common`)

| Guard | File Location | Purpose |
|-------|---------------|---------|
| `JwtAuthGuard` | `packages/auth-common/src/guards/jwt-auth.guard.ts` | Validates JWT tokens and sets `request.user` |
| `StatusGuard` | `packages/auth-common/src/guards/status.guard.ts` | Blocks LOCKED users from all operations |
| `RolesGuard` | `packages/auth-common/src/guards/roles.guard.ts` | Enforces role-based access control |

### ✅ Guards IN Auth Service (Local)

| Guard | File Location | Purpose |
|-------|---------------|---------|
| `ServiceAuthGuard` | `services/auth/src/guards/service-auth.guard.ts` | For internal service-to-service authentication |

### ❌ Removed Guards (No Longer Used)

The following local guard files were **removed** to centralize all guard logic in the shared package:

- ~~`services/auth/src/guards/user-status.guard.ts`~~ → Replaced by `StatusGuard` from package
- ~~`services/auth/src/guards/roles.guard.ts`~~ → Replaced by `RolesGuard` from package
- ~~`services/auth/src/guards/roles.decorator.ts`~~ → Replaced by `@Roles()` from package

---

## Guard Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HTTP REQUEST                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: JwtAuthGuard (Global)                                          │
│  ─────────────────────────────                                          │
│  • Checks if route has @Public() decorator                              │
│  • If @Public() → SKIP (allow without token)                            │
│  • If NOT public → Validate JWT token                                   │
│  • Extract user payload and set request.user                            │
│  • If invalid token → 401 Unauthorized                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: StatusGuard (Global)                                           │
│  ────────────────────────────                                           │
│  • Checks if route has @Public() decorator                              │
│  • If @Public() → SKIP                                                  │
│  • If no user on request → SKIP (let JwtAuthGuard handle)               │
│  • Query database for current user status                               │
│  • If status === 'locked' → 403 Forbidden                               │
│    "Your account has been locked. Please contact support."              │
│  • Attach status to request.user.status                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: RolesGuard (Controller/Route Level)                            │
│  ───────────────────────────────────────────                            │
│  • Checks if route has @Public() decorator                              │
│  • If @Public() → SKIP                                                  │
│  • Get required roles from @Roles() decorator                           │
│  • If no @Roles() → Allow (authentication is enough)                    │
│  • Check if user.status === 'locked' → 403 Forbidden                    │
│    (LOCKED status overrides ALL roles, even super-admin)                │
│  • Check if user.role matches any required role                         │
│  • If no match → 403 Forbidden                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONTROLLER                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Global Guard Registration

Guards are registered globally in `app.module.ts`:

```typescript
// services/auth/src/app.module.ts
import { JwtAuthGuard, StatusGuard } from '@escrowly/auth-common';

@Module({
  providers: [
    // Status checker implementation for StatusGuard
    {
      provide: 'STATUS_CHECKER',
      useClass: UserStatusChecker,
    },
    // Global guards (ORDER MATTERS!)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,  // 1st - Validates token, sets request.user
    },
    {
      provide: APP_GUARD,
      useClass: StatusGuard,   // 2nd - Checks user status in DB
    },
  ],
})
export class AppModule {}
```

---

## User Status Rules

### Only Two Valid Statuses

| Status | Description |
|--------|-------------|
| `active` | User can access all permitted routes based on their role |
| `locked` | User is completely blocked from ALL operations |

> ⚠️ **Note:** The `disabled` status has been **removed** from the system.

### LOCKED Status Behavior

When a user's status is set to `locked`:

| Action | Result |
|--------|--------|
| Login attempt | ❌ Blocked at `auth.service.ts` |
| Token refresh | ❌ Blocked at `auth.service.ts` |
| Access ANY protected route | ❌ Blocked by `StatusGuard` |
| Access role-protected route | ❌ Blocked by `RolesGuard` (double-check) |
| Existing sessions | 🗑️ Immediately revoked when status changes to LOCKED |

### Status Check Implementation

The `StatusGuard` uses dependency injection to query the database:

```typescript
// services/auth/src/auth/user-status.checker.ts
@Injectable()
export class UserStatusChecker implements StatusChecker {
  constructor(private readonly prisma: PrismaService) {}

  async checkUserStatus(userId: string): Promise<UserStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userProfile: true },
    });

    const status = user?.userProfile?.status?.toLowerCase();
    return status === 'locked' ? 'locked' : 'active';
  }
}
```

---

## Role-Based Access Control

### Available Roles

| Role | Description |
|------|-------------|
| `user` | Standard user |
| `super-admin` | Full administrative access |
| `staff-website` | Website staff with limited admin access |

### Admin Controller Permissions

```typescript
// services/auth/src/admin/admin.controller.ts
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  
  @Get('users')
  @Roles('super-admin', 'staff-website')
  async getUsers() {}

  @Patch('users/:user_id/status')
  @Roles('super-admin', 'staff-website')
  async updateUserStatus() {}

  @Patch('users/:user_id/role')
  @Roles('super-admin')  // Only super-admin can change roles
  async updateUserRole() {}

  @Post('users/:user_id/impersonate')
  @Roles('super-admin', 'staff-website')
  async impersonateUser() {}

  @Post('users/:user_id/sessions/revoke')
  @Roles('super-admin', 'staff-website')
  async revokeUserSessions() {}
}
```

### Permission Matrix

| Endpoint | `user` | `staff-website` | `super-admin` |
|----------|--------|-----------------|---------------|
| `GET /admin/users` | ❌ | ✅ | ✅ |
| `PATCH /admin/users/:id/status` | ❌ | ✅ | ✅ |
| `PATCH /admin/users/:id/role` | ❌ | ❌ | ✅ |
| `POST /admin/users/:id/impersonate` | ❌ | ✅ | ✅ |
| `POST /admin/users/:id/sessions/revoke` | ❌ | ✅ | ✅ |

---

## Public Routes

Routes marked with `@Public()` decorator bypass all guards:

### Auth Controller (`/api/v1/auth/*`)

| Route | Method | Public | Description |
|-------|--------|--------|-------------|
| `/auth/signup` | POST | ✅ | Register new user |
| `/auth/login` | POST | ✅ | Login with credentials |
| `/auth/token/refresh` | POST | ✅ | Refresh access token |
| `/auth/password/forgot` | POST | ✅ | Request password reset |
| `/auth/password/reset` | POST | ✅ | Reset password with token |
| `/auth/me` | GET | ❌ | Get current user profile |
| `/auth/profile` | PATCH | ❌ | Update user profile |
| `/auth/logout` | POST | ❌ | Logout current session |
| `/auth/logout-all` | POST | ❌ | Logout all sessions |
| `/auth/2fa/setup` | POST | ❌ | Setup 2FA |
| `/auth/2fa/disable` | POST | ❌ | Disable 2FA |
| `/auth/2fa/status` | GET | ❌ | Get 2FA status |
| `/auth/password/change` | POST | ❌ | Change password (authenticated) |

### Health Controller (`/api/v1/health/*`)

| Route | Method | Public | Description |
|-------|--------|--------|-------------|
| `/health` | GET | ✅ | Basic health check |
| `/health/ready` | GET | ✅ | Readiness check |
| `/health/live` | GET | ✅ | Liveness check |

### App Controller (`/`)

| Route | Method | Public | Description |
|-------|--------|--------|-------------|
| `/` | GET | ✅ | Root endpoint |

---

## Decorators Used

### From `@escrowly/auth-common`

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@Public()` | Mark route as public (no auth required) | `@Public() @Post('login')` |
| `@Roles(...roles)` | Require specific roles | `@Roles('super-admin', 'staff-website')` |

### Usage Example

```typescript
import { Public, Roles, JwtAuthGuard, RolesGuard } from '@escrowly/auth-common';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {

  @Get('dashboard')
  @Roles('super-admin', 'staff-website')
  getDashboard() {
    // Only super-admin and staff-website can access
  }

  @Patch('users/:id/role')
  @Roles('super-admin')
  updateRole() {
    // Only super-admin can change roles
  }
}

@Controller('auth')
export class AuthController {

  @Public()
  @Post('login')
  login() {
    // Anyone can access (no token required)
  }

  @Get('me')
  getMe() {
    // Requires valid JWT (global JwtAuthGuard applies)
  }
}
```

---

## Error Responses

### 401 Unauthorized

Returned when:
- No token provided
- Invalid token
- Expired token

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden

Returned when:
- User account is LOCKED
- User doesn't have required role

```json
{
  "statusCode": 403,
  "message": "Your account has been locked. Please contact support."
}
```

```json
{
  "statusCode": 403,
  "message": "Access denied. Required role: super-admin or staff-website"
}
```

---

## Testing Access Control

### Test as Super-Admin

```bash
# Login as super-admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@example.com", "password": "password"}'

# Use token to change user status
curl -X PATCH http://localhost:3000/api/v1/admin/users/{userId}/status \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"status": "LOCKED", "reason": "Violation of terms"}'
```

### Test LOCKED User Access

```bash
# Try to access protected route as LOCKED user
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer {lockedUserToken}"

# Expected: 403 Forbidden
# Response: {"statusCode":403,"message":"Your account has been locked. Please contact support."}
```

---

## Summary

| Feature | Status |
|---------|--------|
| Guards centralized in `@escrowly/auth-common` | ✅ |
| JwtAuthGuard validates tokens globally | ✅ |
| StatusGuard blocks LOCKED users | ✅ |
| RolesGuard enforces role permissions | ✅ |
| LOCKED status overrides all roles | ✅ |
| Public routes work without auth | ✅ |
| Super-admin can change user status | ✅ |
| Super-admin can change user roles | ✅ |
| Staff-website can change user status | ✅ |
| Sessions revoked when user is LOCKED | ✅ |

---

## File Structure

```
services/auth/
├── src/
│   ├── app.module.ts              # Global guard registration
│   ├── app.controller.ts          # @Public() on root
│   ├── guards/
│   │   └── service-auth.guard.ts  # Local service-to-service guard
│   ├── auth/
│   │   ├── auth.controller.ts     # @Public() on login/signup/etc
│   │   ├── auth.service.ts        # LOCKED check on login/refresh
│   │   └── user-status.checker.ts # StatusChecker implementation
│   ├── admin/
│   │   ├── admin.controller.ts    # @UseGuards + @Roles
│   │   └── admin.service.ts       # Revoke sessions on LOCK
│   └── health/
│       └── health.controller.ts   # @Public() on all health routes

packages/auth-common/
├── src/
│   ├── guards/
│   │   ├── index.ts               # Exports all guards
│   │   ├── jwt-auth.guard.ts      # JWT validation
│   │   ├── status.guard.ts        # LOCKED user blocking
│   │   └── roles.guard.ts         # Role-based access
│   ├── decorators/
│   │   ├── public.decorator.ts    # @Public()
│   │   └── roles.decorator.ts     # @Roles()
│   └── interfaces/
│       └── auth.interfaces.ts     # AuthUser, UserStatus types
```

---

**Last Updated:** December 18, 2025
