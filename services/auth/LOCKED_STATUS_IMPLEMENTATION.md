# LOCKED User Status Implementation

## Overview

This implementation enforces the LOCKED user status across all Escrowly microservices using a centralized shared guard package architecture.

## Architecture Principles

### 1️⃣ Centralized Guards (Shared Package)

All authentication and authorization logic is centralized in `@escrowly/auth-common`:
- **JwtAuthGuard**: Validates JWT tokens
- **StatusGuard**: Enforces user account status (NEW)
- **RolesGuard**: Enforces role-based access control

### 2️⃣ Status Values (Only Two)

User status has ONLY two values:
- **`active`**: User can access all features
- **`locked`**: User is completely blocked

**REMOVED**: `disabled` status (no longer exists)

### 3️⃣ Guard Execution Order

```
Request → JwtAuthGuard → StatusGuard → RolesGuard → Controller
```

1. **JwtAuthGuard**: Validates token, attaches `user` to request
2. **StatusGuard**: Checks user status in DB, blocks if LOCKED
3. **RolesGuard**: Checks user roles (LOCKED status overrides all roles)

---

## Implementation Details

### Shared Package (`@escrowly/auth-common`)

#### StatusGuard

**Location**: `packages/auth-common/src/guards/status.guard.ts`

```typescript
@Injectable()
export class StatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('STATUS_CHECKER') private readonly statusChecker: StatusChecker,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public routes
    if (isPublic) return true;
    
    // Get user from request (set by JwtAuthGuard)
    const user = request.user;
    
    // Check user status in database
    const userStatus = await this.statusChecker.checkUserStatus(user.id);
    
    // Block LOCKED users
    if (userStatus === 'locked') {
      throw new ForbiddenException('Your account has been locked. Please contact support.');
    }
    
    // Attach status to user object
    request.user.status = userStatus;
    return true;
  }
}
```

**Key Features**:
- ✅ Respects `@Public()` decorator
- ✅ Queries database for current status (not token-based)
- ✅ Blocks ALL LOCKED users regardless of role
- ✅ Attaches status to request for downstream use

#### StatusChecker Interface

Services must implement this interface to provide user status checking:

```typescript
export interface StatusChecker {
  checkUserStatus(userId: string): Promise<UserStatus>;
}
```

#### RolesGuard Enhancement

**Location**: `packages/auth-common/src/guards/roles.guard.ts`

Added LOCKED status check that **overrides all roles**:

```typescript
// CRITICAL: LOCKED status overrides ALL roles
// Even super-admin cannot access if LOCKED
if (user.status === 'locked') {
  throw new ForbiddenException('Your account has been locked. Please contact support.');
}
```

**Impact**: 
- Admin with LOCKED status = BLOCKED ✅
- Super-admin with LOCKED status = BLOCKED ✅
- Any role with LOCKED status = BLOCKED ✅

---

### Auth Service Implementation

#### UserStatusChecker

**Location**: `services/auth/src/auth/user-status.checker.ts`

Implements `StatusChecker` interface:

```typescript
@Injectable()
export class UserStatusChecker implements StatusChecker {
  constructor(private readonly prisma: PrismaService) {}

  async checkUserStatus(userId: string): Promise<UserStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userProfile: { select: { status: true } } },
    });
    
    const status = user?.userProfile?.status?.toLowerCase();
    return status === 'locked' ? 'locked' : 'active';
  }
}
```

#### App Module Configuration

**Location**: `services/auth/src/app.module.ts`

```typescript
@Module({
  providers: [
    // Status checker implementation for StatusGuard
    {
      provide: 'STATUS_CHECKER',
      useClass: UserStatusChecker,
    },
    // Global guard to enforce user status
    {
      provide: APP_GUARD,
      useClass: StatusGuard,
    },
  ],
})
export class AppModule {}
```

#### Login/Refresh Status Checks

**Location**: `services/auth/src/auth/auth.service.ts`

Status is checked in three places:
1. **Login**: Before password verification
2. **Token Refresh**: Before issuing new tokens
3. **Get User**: Before returning user data

```typescript
// Check user account status BEFORE password verification
const userStatus = user.userProfile?.status?.toLowerCase() || 'active';

if (userStatus === 'locked') {
  throw new UnauthorizedException('Your account has been locked. Please contact support.');
}
```

#### Session Revocation on Lock

**Location**: `services/auth/src/admin/admin.service.ts`

When admin locks a user, ALL sessions are immediately revoked:

```typescript
// If user is being LOCKED, revoke all their sessions immediately
if (dto.status === 'LOCKED' && oldStatus !== 'locked') {
  const sessionsRevoked = await this.sessionService.revokeAllUserSessions(userId);
  this.logger.log(`Revoked ${sessionsRevoked} sessions for locked user ${userId}`);
}
```

---

## Guard Files Cleanup

### ❌ Removed from Auth Service

The following guard files were **deleted** from auth service:
- `src/guards/user-status.guard.ts`
- `src/guards/roles.guard.ts`
- `src/guards/roles.decorator.ts`
- `src/guards/index.ts`

### ✅ Kept in Auth Service

Only service-specific guard remains:
- `src/guards/service-auth.guard.ts` (for service-to-service auth)

---

## Enforcement Points

### 1. Login Endpoint (`POST /auth/login`)

**Enforcement**: Service-level check in `auth.service.ts`

```
LOCKED user attempts login
↓
Status checked BEFORE password verification
↓
401 Unauthorized: "Your account has been locked. Please contact support."
```

### 2. Token Refresh (`POST /auth/token/refresh`)

**Enforcement**: Service-level check in `auth.service.ts`

```
LOCKED user attempts token refresh
↓
Status checked BEFORE issuing new tokens
↓
401 Unauthorized: "Your account has been locked. Please contact support."
```

### 3. Protected Routes (ALL)

**Enforcement**: Global `StatusGuard` from shared package

```
LOCKED user accesses any protected route
↓
StatusGuard runs after JwtAuthGuard
↓
Queries database for current status
↓
403 Forbidden: "Your account has been locked. Please contact support."
```

### 4. Role-Protected Routes

**Enforcement**: `RolesGuard` from shared package

```
LOCKED admin/super-admin accesses admin route
↓
RolesGuard checks status BEFORE checking roles
↓
403 Forbidden: "Your account has been locked. Please contact support."
```

**Note**: LOCKED status overrides ALL roles, including super-admin.

---

## Database Schema

**Table**: `auth_db.user_profiles`

```sql
CREATE TABLE auth_db.user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth_db.users(id),
  status TEXT DEFAULT 'active', -- 'active' | 'locked'
  -- other fields...
  CHECK (status IN ('active', 'locked'))
);
```

**Status Values**: Only `active` and `locked` (DISABLED removed)

---

## Testing

### Manual Test Steps

1. **Create test user**:
```bash
POST /api/v1/auth/signup
{ "email": "test@example.com", "password": "Test123!", ... }
```

2. **Verify user can login**:
```bash
POST /api/v1/auth/login
{ "email": "test@example.com", "password": "Test123!" }
```

3. **Lock the user (as admin)**:
```bash
PATCH /api/v1/admin/users/{user_id}/status
{ "status": "LOCKED", "reason": "Testing" }
```

4. **Verify user CANNOT login**:
```bash
POST /api/v1/auth/login
# Expected: 401 with "Your account has been locked. Please contact support."
```

5. **Verify user CANNOT use existing token**:
```bash
GET /api/v1/auth/me
Authorization: Bearer {old_token}
# Expected: 403 with "Your account has been locked. Please contact support."
```

6. **Verify user CANNOT refresh token**:
```bash
POST /api/v1/auth/token/refresh
{ "refreshToken": "{refresh_token}" }
# Expected: 401 with "Your account has been locked. Please contact support."
```

---

## Key Benefits

### ✅ Centralized Logic
- All guards in shared package
- No duplication across services
- Single source of truth

### ✅ Consistent Behavior
- Same enforcement across all services
- Same error messages
- Same guard execution order

### ✅ LOCKED Overrides Everything
- Even super-admin is blocked when LOCKED
- No bypass mechanism
- Complete lockout

### ✅ Real-Time Enforcement
- Status checked on every request
- Not token-based (can't bypass with old token)
- Immediate effect after admin locks user

### ✅ Clean Architecture
- Auth service has no duplicate guards
- Uses shared package guards
- Service-specific guard (service-auth) kept separate

---

## Migration Notes

### Breaking Changes

1. **DISABLED status removed**: Update any existing references to use LOCKED instead
2. **Guard imports changed**: Import from `@escrowly/auth-common` instead of local guards
3. **Status checker required**: Services using StatusGuard must provide STATUS_CHECKER

### Database Migration

Update existing DISABLED users to LOCKED:

```sql
UPDATE auth_db.user_profiles 
SET status = 'locked' 
WHERE status = 'disabled';

-- Add CHECK constraint (if not exists)
ALTER TABLE auth_db.user_profiles 
ADD CONSTRAINT check_status 
CHECK (status IN ('active', 'locked'));
```

---

## Files Modified

### Shared Package (`@escrowly/auth-common`)
- `src/guards/status.guard.ts` (NEW)
- `src/guards/roles.guard.ts` (UPDATED - added LOCKED check)
- `src/guards/index.ts` (UPDATED - export StatusGuard)
- `src/interfaces/auth.interfaces.ts` (UPDATED - added UserStatus type)

### Auth Service
- `src/auth/user-status.checker.ts` (NEW - implements StatusChecker)
- `src/auth/auth.service.ts` (UPDATED - removed DISABLED checks)
- `src/auth/auth.module.ts` (UPDATED - export UserStatusChecker)
- `src/admin/admin.service.ts` (UPDATED - removed DISABLED)
- `src/app.module.ts` (UPDATED - use StatusGuard from package)
- `prisma/schema.prisma` (UPDATED - comment changed)
- `src/guards/*` (DELETED - use shared package instead)

---

## Future Enhancements

1. **Redis Caching**: Cache user status for 1-5 minutes to reduce DB queries
2. **Audit Logging**: Log all blocked access attempts by LOCKED users
3. **Temporary Locks**: Support time-based locks that auto-expire
4. **Lock History**: Track when/why user was locked/unlocked

---

## Support

For questions or issues, contact the development team.

**Last Updated**: 2025-12-18
**Version**: 2.0.0 (Refactored to use shared guards)
