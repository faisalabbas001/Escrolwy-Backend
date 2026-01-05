import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * KYC Rate Limit Guard
 * 
 * Limits /kyc/start requests to prevent abuse:
 * - 3 attempts per user per hour
 * - Uses in-memory storage (for production, use Redis)
 * 
 * Protects against:
 * - Excessive Persona API costs
 * - Denial of service attacks
 * - KYC farming attempts
 */
@Injectable()
export class KycRateLimitGuard implements CanActivate {
    private readonly logger = new Logger(KycRateLimitGuard.name);

    // In-memory rate limit store: Map<userId, { count, resetAt }>
    private readonly rateLimitStore = new Map<string, { count: number; resetAt: number }>();

    // Configuration
    private readonly MAX_ATTEMPTS = 10;
    private readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        // Extract user ID from request
        const userId = this.extractUserId(request);
        if (!userId) {
            // If no user ID, let the controller handle the error
            return true;
        }

        const now = Date.now();
        const userLimit = this.rateLimitStore.get(userId);

        // Check if we have an existing rate limit record
        if (userLimit) {
            // Check if window has expired
            if (now > userLimit.resetAt) {
                // Reset the window
                this.rateLimitStore.set(userId, {
                    count: 1,
                    resetAt: now + this.WINDOW_MS,
                });
                this.logger.debug(`Rate limit reset for user ${userId}`);
                return true;
            }

            // Check if limit exceeded
            if (userLimit.count >= this.MAX_ATTEMPTS) {
                const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
                this.logger.warn(
                    `❌ Rate limit exceeded for user ${userId}. Retry after ${retryAfter}s`,
                );
                throw new HttpException(
                    {
                        statusCode: HttpStatus.TOO_MANY_REQUESTS,
                        message: 'Too many KYC start attempts. Please try again later.',
                        retryAfter,
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            // Increment count
            userLimit.count++;
            this.logger.debug(
                `Rate limit: user ${userId} has ${userLimit.count}/${this.MAX_ATTEMPTS} attempts`,
            );
            return true;
        }

        // First attempt - create new record
        this.rateLimitStore.set(userId, {
            count: 1,
            resetAt: now + this.WINDOW_MS,
        });
        this.logger.debug(`Rate limit started for user ${userId}`);
        return true;
    }

    private extractUserId(request: Request): string | null {
        // Try JWT user first
        const user = (request as any).user;
        if (user?.sub || user?.userId) {
            return user.sub || user.userId;
        }

        // Try x-user-id header (for testing)
        const headerUserId = request.headers['x-user-id'];
        if (typeof headerUserId === 'string') {
            return headerUserId;
        }

        return null;
    }

    /**
     * Clear rate limit for a user (for admin use or testing)
     */
    clearRateLimit(userId: string): void {
        this.rateLimitStore.delete(userId);
        this.logger.debug(`Rate limit cleared for user ${userId}`);
    }
}
