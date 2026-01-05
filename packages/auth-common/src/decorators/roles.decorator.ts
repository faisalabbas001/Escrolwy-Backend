import { SetMetadata } from '@nestjs/common';
import { Role } from '../interfaces';

/**
 * Metadata key for roles
 */
export const ROLES_KEY = 'roles';

/**
 * @Roles() Decorator
 *
 * Restricts access to specific roles.
 * Use with RolesGuard to enforce role-based access control.
 *
 * @param roles - Array of roles that can access this route
 *
 * @example
 * ```typescript
 * // Single role
 * @Roles(Role.SUPER_ADMIN)
 * @Get('admin/users')
 * getAllUsers() {}
 *
 * // Multiple roles
 * @Roles(Role.USER, Role.SUPER_ADMIN)
 * @Post('escrows')
 * createEscrow() {}
 *
 * // Using string values
 * @Roles('user', 'super-admin')
 * @Get('profile')
 * getProfile() {}
 * ```
 */
export const Roles = (...roles: (Role | string)[]) =>
  SetMetadata(ROLES_KEY, roles);

