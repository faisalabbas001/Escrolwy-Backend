import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '../interfaces';

/**
 * @Auth() Decorator
 *
 * Combined decorator that applies JWT authentication and optional role-based access control.
 * Use this when NOT using global guards (route-level protection).
 *
 * For global guards setup, use @Roles() decorator instead.
 *
 * @param roles - Optional array of roles that can access this route
 *
 * @example
 * ```typescript
 * // Just authentication (any logged-in user)
 * @Auth()
 * @Get('profile')
 * getProfile() {}
 *
 * // Authentication + specific role
 * @Auth(Role.USER)
 * @Post('escrows')
 * createEscrow() {}
 *
 * // Authentication + multiple roles
 * @Auth(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
 * @Get('admin/dashboard')
 * getDashboard() {}
 * ```
 */
export function Auth(...roles: (Role | string)[]) {
  if (roles.length === 0) {
    // Just authentication, no specific roles required
    return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard));
  }

  // Authentication + role check
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}

/**
 * @RequireAuth() Decorator
 *
 * Decorator that requires authentication but no specific role.
 * Use when NOT using global guards (route-level protection).
 *
 * @example
 * ```typescript
 * @RequireAuth()
 * @Get('my-profile')
 * getMyProfile(@CurrentUser() user: AuthUser) {
 *   return user;
 * }
 * ```
 */
export function RequireAuth() {
  return applyDecorators(UseGuards(JwtAuthGuard));
}

/**
 * @AdminOnly() Decorator
 *
 * Shorthand for routes that require super-admin role.
 * Use when NOT using global guards (route-level protection).
 *
 * @example
 * ```typescript
 * @AdminOnly()
 * @Get('users')
 * getAllUsers() {}
 * ```
 */
export function AdminOnly() {
  return Auth(Role.SUPER_ADMIN);
}

/**
 * @StaffOnly() Decorator
 *
 * Shorthand for routes that require staff (super-admin or staff-website) role.
 * Use when NOT using global guards (route-level protection).
 *
 * @example
 * ```typescript
 * @StaffOnly()
 * @Get('reports')
 * getReports() {}
 * ```
 */
export function StaffOnly() {
  return Auth(Role.SUPER_ADMIN, Role.STAFF_WEBSITE);
}
