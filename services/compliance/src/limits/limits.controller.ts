import { Controller, Get, Param, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@escrowly/auth-common';
import { LimitsService } from './limits.service';

/**
 * Limits Controller
 *
 * Provides API for retrieving user limits.
 * JWT authentication is required for all endpoints.
 */
@ApiTags('limits')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller({
    path: 's2s/limits',
    version: '1',
})
export class LimitsController {
    private readonly logger = new Logger(LimitsController.name);

    constructor(private readonly limitsService: LimitsService) { }

    /**
     * Get all limits for a user
     * Requires JWT authentication
     */
    @Get(':userId')
    @ApiOperation({ summary: 'Get all limits for user' })
    @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
    @ApiResponse({
        status: 200,
        description: 'All limits for user',
        schema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
                escrowLimit: { type: 'number' },
                ledgerLimit: { type: 'number' },
                hasLimits: { type: 'boolean' },
                updatedAt: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized - JWT required' })
    async getLimits(@Param('userId') userId: string) {
        this.logger.debug(`Getting limits for user ${userId}`);
        return this.limitsService.getLimits(userId);
    }
}
