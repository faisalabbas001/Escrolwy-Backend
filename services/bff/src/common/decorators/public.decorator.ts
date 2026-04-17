import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark routes as public (no JWT required)
 * 
 * Usage:
 * @Public()
 * @Get('public-endpoint')
 * async publicEndpoint() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

