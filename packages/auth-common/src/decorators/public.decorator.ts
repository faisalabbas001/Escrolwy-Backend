import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for public routes
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() Decorator
 *
 * Marks a route as public, bypassing JWT authentication.
 * Use this for endpoints that should be accessible without authentication.
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

