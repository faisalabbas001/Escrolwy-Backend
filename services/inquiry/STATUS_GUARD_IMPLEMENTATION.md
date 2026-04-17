# StatusGuard Implementation - Inquiry Service

## Overview

The Inquiry Service now implements a global `StatusGuard` from `@escrowly/auth-common` that blocks users whose account status is `LOCKED`. This guard runs after JWT authentication and applies to all protected routes, while allowing explicitly marked public routes.

## Implementation Details

### 1. Dependencies

Added `@escrowly/auth-common` package to `package.json`:
```json
"@escrowly/auth-common": "file:../../packages/auth-common"
```

### 2. UserStatusChecker

Created `src/auth/user-status.checker.ts` that implements the `StatusChecker` interface:

- **Location**: `services/inquiry/src/auth/user-status.checker.ts`
- **Purpose**: Checks user status from the `auth_db` schema
- **Method**: Uses raw SQL to query `auth_db.user_profiles` table
- **Behavior**: 
  - Returns `'locked'` if user status is `'locked'`
  - Returns `'active'` for all other cases (including when user/profile not found)
  - Defaults to `'active'` on errors to avoid blocking legitimate requests

### 3. App Module Configuration

Updated `src/app.module.ts` to:

1. Import `StatusGuard` from `@escrowly/auth-common`
2. Import `APP_GUARD` from `@nestjs/core`
3. Register `UserStatusChecker` as `'STATUS_CHECKER'` provider
4. Register `StatusGuard` as a global guard using `APP_GUARD`

### 4. Public Routes

Marked health check endpoints as public using `@Public()` decorator:

- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/ready` - Readiness check

## How It Works

1. **JWT Authentication** (if configured): User authenticates and `req.user` is populated
2. **StatusGuard Execution**: 
   - Checks if route is marked as `@Public()` - if yes, allows access
   - If no user on request, allows access (let auth guard handle it)
   - Calls `UserStatusChecker.checkUserStatus(userId)` to get user status
   - If status is `'locked'`, throws `ForbiddenException` with message: "Your account has been locked. Please contact support."
   - If status is `'active'`, attaches status to `req.user.status` and allows access

## Database Access

The `UserStatusChecker` queries the `auth_db` schema directly using raw SQL:

```sql
SELECT up.status
FROM auth_db.user_profiles up
WHERE up.user_id = $1::uuid
LIMIT 1
```

This works because:
- Both services (auth and inquiry) use the same PostgreSQL instance
- They just use different schemas (`auth_db` vs `inquiry_db`)
- Raw SQL allows cross-schema queries

## Usage

### Marking Routes as Public

To make a route accessible without authentication or status checking:

```typescript
import { Public } from '@escrowly/auth-common';

@Public()
@Get('some-public-endpoint')
publicEndpoint() {
  return { message: 'This is public' };
}
```

### Protected Routes

All other routes are automatically protected. The guard will:
- Check user status if `req.user` exists
- Block `LOCKED` users
- Allow `ACTIVE` users

## Error Handling

- **LOCKED User Access**: Returns `403 Forbidden` with message "Your account has been locked. Please contact support."
- **Database Query Failure**: Defaults to `'active'` to avoid blocking legitimate requests (logs error)

## Testing

To test the implementation:

1. **With Active User**: Should work normally
2. **With Locked User**: Should receive 403 Forbidden
3. **Public Routes**: Should work without authentication
4. **No User (No JWT)**: Guard allows access (JWT guard should handle authentication)

## Notes

- The guard runs **after** JWT authentication (if configured)
- If JWT authentication is not set up, the guard will still work but won't have `req.user` available
- The guard is **global** - applies to all routes unless marked `@Public()`
- User status is attached to `req.user.status` for downstream use

## Future Considerations

If you need to change how user status is checked (e.g., HTTP call to auth service instead of direct DB query), modify the `UserStatusChecker` implementation.

