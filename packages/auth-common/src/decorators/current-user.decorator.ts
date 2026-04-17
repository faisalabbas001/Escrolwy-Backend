import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../interfaces';

/**
 * @CurrentUser() Decorator
 *
 * Extracts the authenticated user from the request.
 * Can optionally extract a specific property from the user object.
 *
 * @param data - Optional property name to extract from user
 *
 * @example
 * ```typescript
 * // Get full user object
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthUser) {
 *   return { userId: user.id, email: user.email };
 * }
 *
 * // Get specific property
 * @Get('my-escrows')
 * getMyEscrows(@CurrentUser('id') userId: string) {
 *   return this.escrowService.getUserEscrows(userId);
 * }
 *
 * // Get user role
 * @Get('dashboard')
 * getDashboard(@CurrentUser('role') role: string) {
 *   return this.dashboardService.getByRole(role);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      return null;
    }

    // If a specific property is requested, return just that property
    if (data) {
      return user[data];
    }

    // Otherwise return the full user object
    return user;
  },
);

