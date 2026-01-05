import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser, UserStatus } from '../interfaces';

/**
 * Status Guard Interface
 * Services must implement this to provide user status checking
 */
export interface StatusChecker {
  checkUserStatus(userId: string): Promise<UserStatus>;
}

/**
 * Status Guard
 *
 * Enforces user account status restrictions globally.
 * - LOCKED users are completely blocked from all operations
 * - ACTIVE users can proceed normally
 *
 * This guard must run after JwtAuthGuard to have access to req.user.
 *
 * @example
 * ```typescript
 * // In service (e.g., auth service)
 * @Injectable()
 * export class UserStatusChecker implements StatusChecker {
 *   constructor(private prisma: PrismaService) {}
 *
 *   async checkUserStatus(userId: string): Promise<UserStatus> {
 *     const user = await this.prisma.user.findUnique({
 *       where: { id: userId },
 *       include: { userProfile: true },
 *     });
 *     return (user?.userProfile?.status?.toLowerCase() as UserStatus) || 'active';
 *   }
 * }
 *
 * // Register in module
 * providers: [
 *   {
 *     provide: 'STATUS_CHECKER',
 *     useClass: UserStatusChecker,
 *   },
 *   {
 *     provide: APP_GUARD,
 *     useClass: StatusGuard,
 *   },
 * ]
 * ```
 */
@Injectable()
export class StatusGuard implements CanActivate {
  private readonly logger = new Logger(StatusGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject('STATUS_CHECKER')
    private readonly statusChecker: StatusChecker,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    // If no user on request, let authentication guard handle it
    if (!user || !user.id) {
      return true;
    }

    // Check user status from database
    const userStatus = await this.statusChecker.checkUserStatus(user.id);

    // Block LOCKED users completely
    if (userStatus === 'locked') {
      this.logger.warn(
        `LOCKED user ${user.id} attempted to access ${request.method} ${request.url}`,
      );
      throw new ForbiddenException(
        'Your account has been locked. Please contact support.',
      );
    }

    // Attach status to user object for downstream use
    request.user.status = userStatus;

    return true;
  }
}
