import {
    Controller,
    Get,
    Patch,
    Post,
    Param,
    Body,
    Logger,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, Role } from '@escrowly/auth-common';
import { AdminService } from './admin.service';
import { AdjustLimitsDto, KycDecisionDto, ResetKycDto } from './dto';

/**
 * Admin Controller
 *
 * Endpoints for admin operations on compliance:
 * - GET /admin/kyc/flagged - List flagged users
 * - PATCH /admin/kyc/:userId/approve - Approve KYC
 * - PATCH /admin/kyc/:userId/reject - Reject KYC
 * - PATCH /admin/limits/:userId - Adjust limits
 * - POST /admin/kyc/:userId/reset - Reset KYC
 * 
 * Security:
 * - Requires JWT authentication
 * - Restricted to SUPER_ADMIN and STAFF_WEBSITE roles
 * - Locked users are automatically blocked by RolesGuard
 */
@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
@Controller({
    path: 'admin',
    version: '1',
})
export class AdminController {
    private readonly logger = new Logger(AdminController.name);

    constructor(private readonly adminService: AdminService) { }

    /**
     * Get list of flagged users requiring review
     */
    @Get('kyc/flagged')
    @ApiOperation({ summary: 'Get list of flagged users requiring review' })
    @ApiResponse({ status: 200, description: 'List of flagged users' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin role or account locked' })
    async getFlaggedUsers() {
        this.logger.debug('Getting flagged users for review');
        return this.adminService.getFlaggedUsers();
    }

    /**
     * Manually approve a user's KYC
     */
    @Patch('kyc/:userId/approve')
    @ApiOperation({ summary: 'Manually approve user KYC' })
    @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
    @ApiResponse({
        status: 200,
        description: 'KYC approved successfully',
    })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin role or account locked' })
    @ApiResponse({ status: 404, description: 'KYC record not found' })
    async approveKyc(
        @Param('userId') userId: string,
        @Body() dto: KycDecisionDto,
    ) {
        this.logger.log(`Admin approving KYC for user ${userId}`);
        return this.adminService.approveKyc(userId, dto.reason);
    }

    /**
     * Manually reject a user's KYC
     */
    @Patch('kyc/:userId/reject')
    @ApiOperation({ summary: 'Manually reject user KYC' })
    @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
    @ApiResponse({ status: 200, description: 'KYC rejected successfully' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin role or account locked' })
    @ApiResponse({ status: 404, description: 'KYC record not found' })
    async rejectKyc(
        @Param('userId') userId: string,
        @Body() dto: KycDecisionDto,
    ) {
        this.logger.log(`Admin rejecting KYC for user ${userId}`);
        return this.adminService.rejectKyc(userId, dto.reason);
    }

    /**
     * Adjust user limits
     */
    @Patch('limits/:userId')
    @ApiOperation({ summary: 'Adjust user limits' })
    @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
    @ApiResponse({ status: 200, description: 'Limits adjusted successfully' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin role or account locked' })
    @ApiResponse({ status: 404, description: 'KYC record not found' })
    async adjustLimits(
        @Param('userId') userId: string,
        @Body() dto: AdjustLimitsDto,
    ) {
        this.logger.log(`Admin adjusting limits for user ${userId}`);
        return this.adminService.adjustLimits(
            userId,
            dto.escrowLimit,
            dto.ledgerLimit,
        );
    }

    /**
     * Reset KYC for a user (exceptional cases)
     */
    @Post('kyc/:userId/reset')
    @ApiOperation({ summary: 'Reset user KYC (exceptional cases)' })
    @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
    @ApiResponse({ status: 201, description: 'KYC reset successfully' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin role or account locked' })
    @ApiResponse({ status: 404, description: 'KYC record not found' })
    async resetKyc(
        @Param('userId') userId: string,
        @Body() dto: ResetKycDto,
    ) {
        this.logger.log(`Admin resetting KYC for user ${userId}`);
        return this.adminService.resetKyc(userId, dto.reason);
    }
}
