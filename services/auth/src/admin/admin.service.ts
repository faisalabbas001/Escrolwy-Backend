import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { JwtService } from '../auth/jwt.service';
import { SessionService } from '../auth/session.service';
import { AuthEventProducer } from '../kafka';
import {
    GetUsersQueryDto,
    UpdateUserStatusDto,
    UpdateUserRoleDto,
    UserListResponseDto,
    UpdateStatusResponseDto,
    UpdateRoleResponseDto,
    ImpersonationResponseDto,
    RevokeSessionsResponseDto,
} from './dto';

/**
 * Admin Service
 * 
 * Handles administrative operations on users
 */
@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly sessionService: SessionService,
        private readonly eventProducer: AuthEventProducer,
  ) {}

    /**
     * Get paginated list of users with filters
     */
    async getUsers(query: GetUsersQueryDto): Promise<UserListResponseDto> {
        const { q, role, status, kyc_state, page = 1, page_size = 50 } = query;
    console.log('1');
        // Build where clause
        const where: any = {};

        if (q) {
            where.OR = [
                { email: { contains: q, mode: 'insensitive' } },
                { userProfile: { displayName: { contains: q, mode: 'insensitive' } } },
            ];
        }
    console.log('2');
        if (role) {
            where.role = role;
        }

        if (status) {
            where.userProfile = {
                ...where.userProfile,
                status: status.toLowerCase(), // active | locked | disabled
            };
        }
    console.log('3');
        if (kyc_state) {
            where.userProfile = {
                ...where.userProfile,
                kycStatus: kyc_state,
            };
        }
    console.log('4');
        // Get total count
        const total = await this.prisma.user.count({ where });
    console.log('5');
        // Get paginated users
        const users = await this.prisma.user.findMany({
            where,
            include: {
                userProfile: true,
                kycStatusRecord: true,
            },
            skip: (page - 1) * page_size,
            take: page_size,
            orderBy: { createdAt: 'desc' },
        });
    console.log('6');
        // Format response
    const items = users.map((user) => ({
            user_id: user.id,
            email: user.email,
            role: user.role,
            status: user.userProfile?.status?.toUpperCase() || 'ACTIVE',
      kyc: user.kycStatusRecord
        ? {
                state: user.kycStatusRecord.status,
                updated_at: user.kycStatusRecord.updatedAt,
          }
        : null,
            created_at: user.createdAt,
            last_login_at: null, // Would need to track this
        }));
    console.log('7');
        return {
            items,
            page,
            page_size,
            total,
        };
    }

    /**
     * Update user status
     */
    async updateUserStatus(
        userId: string,
        dto: UpdateUserStatusDto,
        adminId: string,
    ): Promise<UpdateStatusResponseDto> {
        this.logger.log(`Updating status for user ${userId} to ${dto.status}`);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { userProfile: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const oldStatus = user.userProfile?.status || 'active';

        // Update status in UserProfile
        await this.prisma.userProfile.update({
            where: { userId: userId },
            data: { status: dto.status.toLowerCase() },
        });

    // If user is being LOCKED, revoke all their sessions immediately
    if (dto.status === 'LOCKED' && oldStatus !== 'locked') {
      const sessionsRevoked =
        await this.sessionService.revokeAllUserSessions(userId);
      this.logger.log(
        `Revoked ${sessionsRevoked} sessions for locked user ${userId}`,
      );
    }

        // Emit appropriate event
        if (dto.status === 'LOCKED' && oldStatus !== 'locked') {
            await this.eventProducer.userLocked(userId, adminId, dto.reason);
        } else if (dto.status === 'ACTIVE' && oldStatus === 'locked') {
            await this.eventProducer.userUnlocked(userId, adminId, dto.reason);
        }

    this.logger.log(
      `User ${userId} status updated to ${dto.status} by admin ${adminId}`,
    );

        return { status: dto.status };
    }

    async updateUserRole(
        userId: string,
        dto: UpdateUserRoleDto,
        adminId: string,
    ): Promise<UpdateRoleResponseDto> {
        this.logger.log(`Updating role for user ${userId} to ${dto.role}`);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const oldRole = user.role;

        await this.prisma.user.update({
            where: { id: userId },
            data: { role: dto.role },
        });

        // Emit role changed event
    await this.eventProducer.userRoleChanged(
      userId,
      oldRole,
      dto.role,
      adminId,
    );

    this.logger.log(
      `User ${userId} role updated from ${oldRole} to ${dto.role} by admin ${adminId}`,
    );

        return { role: dto.role };
    }

    /**
     * Generate impersonation token
     */
    async generateImpersonationToken(
        userId: string,
        adminId: string,
    ): Promise<ImpersonationResponseDto> {
    this.logger.log(
      `Admin ${adminId} requesting impersonation token for user ${userId}`,
    );

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Generate impersonation token (15 minutes)
    const token = this.jwtService.generateImpersonationToken(
      userId,
      user.email,
      user.role,
      adminId,
    );

        // TODO: Audit log this action

        return {
            impersonation_token: token,
            expires_in: 900, // 15 minutes
        };
    }

    /**
     * Revoke all user sessions
     */
    async revokeUserSessions(userId: string): Promise<RevokeSessionsResponseDto> {
        this.logger.log(`Revoking all sessions for user ${userId}`);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.sessionService.revokeAllUserSessions(userId);

        this.logger.log(`All sessions revoked for user ${userId}`);

        return { revoked: true };
    }
}
