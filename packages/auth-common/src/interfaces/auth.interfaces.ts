/**
 * Auth Common Interfaces
 *
 * Shared types for authentication across all Escrowly microservices
 */

/**
 * User roles in the Escrowly platform
 */
export enum Role {
  USER = 'user',
  SUPER_ADMIN = 'super-admin',
  STAFF_WEBSITE = 'staff-website',
}

/**
 * User account status
 * - active: User can access all features
 * - locked: User is completely blocked (admin action)
 */
export type UserStatus = 'active' | 'locked';

/**
 * JWT Access Token Payload
 * This matches the payload structure from auth service
 */
export interface JwtPayload {
  /** User ID (subject) */
  sub: string;
  /** User email */
  email: string;
  /** User role */
  role: string;
  /** Session ID */
  sessionId: string;
  /** Token type */
  type: 'access' | 'refresh';
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
  /** Issuer */
  iss?: string;
  /** Audience */
  aud?: string;
}

/**
 * Authenticated User object attached to request
 */
export interface AuthUser {
  /** User ID */
  id: string;
  /** User email */
  email: string;
  /** User role */
  role: Role | string;
  /** Session ID */
  sessionId: string;
  /** User account status (set by StatusGuard) */
  status?: UserStatus;
}

/**
 * Extended Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * JWT Configuration options
 */
export interface JwtConfig {
  /** JWT secret key */
  secret: string;
  /** Token issuer (default: 'escrowly-auth') */
  issuer?: string;
  /** Token audience (default: 'escrowly') */
  audience?: string;
}

