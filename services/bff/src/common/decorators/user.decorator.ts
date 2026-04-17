import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User info attached to request by JwtAuthGuard
 */
export interface RequestUser {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

/**
 * Decorator to extract user from request
 * 
 * Usage:
 * @Get('profile')
 * async getProfile(@User() user: RequestUser) {
 *   return user;
 * }
 */
export const User = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);

