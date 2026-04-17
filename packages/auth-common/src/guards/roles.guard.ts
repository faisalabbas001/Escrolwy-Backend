import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role, AuthUser } from '../interfaces';

/**
 * Roles Guard
 *
 * Enforces role-based access control using the @Roles() decorator.
 * Must be used after JwtAuthGuard to have access to req.user.
 *
 * @example
 * ```typescript
 * // Apply with JwtAuthGuard
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Controller('admin')
 * export class AdminController {
 *
 *   @Roles(Role.SUPER_ADMIN)
 *   @Get('users')
 *   getAllUsers() {}
 *
 *   @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
 *   @Get('dashboard')
 *   getDashboard() {}
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles specified, allow access (authentication is enough)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      this.logger.warn(
        'RolesGuard: No user found on request. Ensure JwtAuthGuard runs before RolesGuard.',
      );
      throw new ForbiddenException('Access denied');
    }

    // CRITICAL: LOCKED status overrides ALL roles
    // Even super-admin cannot access if LOCKED
    if (user.status === 'locked') {
      this.logger.warn(
        `LOCKED user ${user.id} with role '${user.role}' attempted to access role-protected route`,
      );
      throw new ForbiddenException(
        'Your account has been locked. Please contact support.',
      );
    }

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some((role) => {
      // Handle both enum and string comparisons
      const userRole = user.role.toString().toLowerCase();
      const requiredRole = role.toString().toLowerCase();
      return userRole === requiredRole;
    });

    if (!hasRole) {
      this.logger.debug(
        `User ${user.id} with role '${user.role}' denied access. Required roles: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}

