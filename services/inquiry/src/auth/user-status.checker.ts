import { Injectable } from '@nestjs/common';
import { StatusChecker, UserStatus } from '@escrowly/auth-common';
import { PrismaService } from '../prisma';

/**
 * User Status Checker Implementation for Inquiry Service
 *
 * Provides user status checking for the StatusGuard from shared package.
 * Since the inquiry service uses a different database schema (inquiry_db),
 * we query the auth_db schema directly using raw SQL.
 *
 * Note: Both services use the same PostgreSQL instance, just different schemas.
 */
@Injectable()
export class UserStatusChecker implements StatusChecker {
  constructor(private readonly prisma: PrismaService) {}

  async checkUserStatus(userId: string): Promise<UserStatus> {
    try {
      // Query user status from auth_db schema using raw SQL
      // This works because both services share the same PostgreSQL instance
      const result = await this.prisma.$queryRaw<Array<{ status: string }>>`
        SELECT up.status
        FROM auth_db.user_profiles up
        WHERE up.user_id = ${userId}::uuid
        LIMIT 1
      `;

      const status = result[0]?.status?.toLowerCase();

      // Only return 'active' or 'locked'
      if (status === 'locked') {
        return 'locked';
      }

      // Default to 'active' if no profile found or status is not 'locked'
      return 'active';
    } catch (error) {
      // If query fails (e.g., user doesn't exist, schema not accessible),
      // default to 'active' to avoid blocking legitimate requests
      // In production, you might want to log this and handle differently
      console.error(`Failed to check user status for ${userId}:`, error);
      return 'active';
    }
  }
}

