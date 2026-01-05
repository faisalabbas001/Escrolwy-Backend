import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtService } from '../auth/jwt.service';
import { JwtAuthGuard, RolesGuard, Roles } from '@escrowly/auth-common';
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
 * Admin Controller
 *
 * Admin-only endpoints for user management
 * Requires admin/super-admin role
 */
@Controller('admin')
@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Get list of users with filters
   */
  @Get('users')
  @Roles('super-admin', 'staff-website')
  @ApiOperation({ summary: 'Get list of users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User list',
    type: UserListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getUsers(
    @Query() query: GetUsersQueryDto,
  ): Promise<UserListResponseDto> {
    return this.adminService.getUsers(query);
  }

  /**
   * Update user status
   */
  @Patch('users/:user_id/status')
  @Roles('super-admin', 'staff-website')
  @ApiOperation({ summary: 'Update user status (admin only)' })
  @ApiParam({ name: 'user_id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Status updated',
    type: UpdateStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(
    @Param('user_id') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @Headers('authorization') authHeader: string,
  ): Promise<UpdateStatusResponseDto> {
    const token = authHeader?.substring(7);
    const payload = this.jwtService.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }
    const adminId = payload.sub;
    return this.adminService.updateUserStatus(userId, dto, adminId);
  }

  /**
   * Update user role
   */
  @Patch('users/:user_id/role')
  @Roles('super-admin')
  @ApiOperation({ summary: 'Update user role (super-admin only)' })
  @ApiParam({ name: 'user_id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Role updated',
    type: UpdateRoleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserRole(
    @Param('user_id') userId: string,
    @Body() dto: UpdateUserRoleDto,
    @Headers('authorization') authHeader: string,
  ): Promise<UpdateRoleResponseDto> {
    const token = authHeader?.substring(7);
    const payload = this.jwtService.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }
    const adminId = payload.sub;
    return this.adminService.updateUserRole(userId, dto, adminId);
  }

  /**
   * Generate impersonation token
   */
  @Post('users/:user_id/impersonate')
  @Roles('super-admin', 'staff-website')
  @ApiOperation({ summary: 'Generate impersonation token (admin only)' })
  @ApiParam({ name: 'user_id', description: 'User ID to impersonate' })
  @ApiResponse({
    status: 200,
    description: 'Impersonation token generated',
    type: ImpersonationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async impersonateUser(
    @Param('user_id') userId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<ImpersonationResponseDto> {
    // Extract admin ID from token
    const token = authHeader?.substring(7);
    const payload = this.jwtService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.adminService.generateImpersonationToken(userId, payload.sub);
  }

  /**
   * Revoke all user sessions
   */
  @Post('users/:user_id/sessions/revoke')
  @Roles('super-admin', 'staff-website')
  @ApiOperation({ summary: 'Revoke all user sessions (admin only)' })
  @ApiParam({ name: 'user_id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Sessions revoked',
    type: RevokeSessionsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async revokeUserSessions(
    @Param('user_id') userId: string,
  ): Promise<RevokeSessionsResponseDto> {
    return this.adminService.revokeUserSessions(userId);
  }
}
