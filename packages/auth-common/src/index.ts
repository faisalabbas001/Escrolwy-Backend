/**
 * @escrowly/auth-common
 *
 * Shared authentication guards and decorators for Escrowly microservices.
 *
 * @example
 * ```typescript
 * import {
 *   // Module
 *   AuthCommonModule,
 *
 *   // Guards
 *   JwtAuthGuard,
 *   RolesGuard,
 *
 *   // Decorators
 *   Public,
 *   Roles,
 *   CurrentUser,
 *
 *   // Interfaces & Types
 *   Role,
 *   AuthUser,
 *   JwtPayload,
 * } from '@escrowly/auth-common';
 * ```
 */

// Module
export * from './auth-common.module';

// Guards
export * from './guards';

// Interceptors
export * from './interceptors';

// Decorators
export * from './decorators';

// Interfaces & Types
export * from './interfaces';

