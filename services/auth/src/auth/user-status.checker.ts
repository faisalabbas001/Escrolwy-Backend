import { Injectable } from '@nestjs/common';
import { StatusChecker, UserStatus } from '@escrowly/auth-common';
import { PrismaService } from '../prisma';

/**
 * User Status Checker Implementation
 *
 * Provides user status checking for the StatusGuard from shared package
 */
@Injectable()
export class UserStatusChecker implements StatusChecker {
  constructor(private readonly prisma: PrismaService) {}

  async checkUserStatus(userId: string): Promise<UserStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userProfile: {
          select: {
            status: true,
          },
        },
      },
    });

    const status = user?.userProfile?.status?.toLowerCase();

    // Only return 'active' or 'locked'
    if (status === 'locked') {
      return 'locked';
    }

    return 'active';
  }
}
