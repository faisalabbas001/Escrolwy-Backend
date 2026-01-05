import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    HttpCode,
    HttpStatus,
    RawBodyRequest,
    Headers,
    Logger,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard, Public } from '@escrowly/auth-common';
import { KycService } from './kyc.service';
import { StartKycDto, StartKycResponseDto, KycStatusResponseDto } from './dto';
import { PersonaWebhookPayload, PersonaService } from '../persona';
import { KycRateLimitGuard } from './guards';

/**
 * KYC Controller
 *
 * Handles KYC-related endpoints:
 * - POST /kyc/start - Start KYC process (rate limited, JWT required)
 * - POST /kyc/webhook - Persona webhook callback (public)
 * - GET /kyc/status - Get current KYC status (JWT required)
 * 
 * Security:
 * - User endpoints require JWT authentication
 * - Webhook is public (called by Persona)
 */
@ApiTags('kyc')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller({
    path: 'kyc',
    version: '1',
})
export class KycController {
    private readonly logger = new Logger(KycController.name);

    constructor(
        private readonly kycService: KycService,
        private readonly personaService: PersonaService,
    ) { }

    /**
     * Start KYC process for authenticated user
     * Rate limited to 3 attempts per hour per user
     */
    @Post('start')
    @UseGuards(KycRateLimitGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Start KYC verification process' })
    @ApiResponse({
        status: 200,
        description: 'KYC process started',
        type: StartKycResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 409, description: 'KYC already approved' })
    @ApiResponse({ status: 429, description: 'Too many requests' })
    async startKyc(
        @Req() req: Request,
        @Body() dto: StartKycDto,
    ): Promise<StartKycResponseDto> {
        // Get user ID from JWT token (set by JwtAuthGuard as 'id')
        const userId = (req as any).user?.id;

        if (!userId) {
            throw new UnauthorizedException('User ID not found in token');
        }

        return this.kycService.startKyc(userId, dto.referenceId, dto.redirectUri);
    }

    /**
     * Get KYC status for authenticated user
     */
    @Get('status')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get current KYC status' })
    @ApiResponse({
        status: 200,
        description: 'Current KYC status',
        type: KycStatusResponseDto,
    })
    async getStatus(@Req() req: Request): Promise<KycStatusResponseDto> {
        // Get user ID from JWT token (set by JwtAuthGuard as 'id')
        const userId = (req as any).user?.id;

        if (!userId) {
            throw new UnauthorizedException('User ID not found in token');
        }

        return this.kycService.getStatus(userId);
    }

    /**
     * Persona webhook callback
     * This endpoint receives verification results from Persona
     * @Public - No JWT required, Persona signature verification is used instead
     */
    @Public()
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Persona webhook callback' })
    @ApiHeader({
        name: 'Persona-Signature',
        description: 'Webhook signature from Persona',
        required: true,
    })
    @ApiResponse({ status: 200, description: 'Webhook processed' })
    @ApiResponse({ status: 400, description: 'Invalid signature' })
    async handleWebhook(
        @Req() req: any,
        @Headers('persona-signature') signature: string,
    ): Promise<{ success: boolean; message: string }> {
        const rawBody: Buffer = req.rawBody;
        const payload: PersonaWebhookPayload = req.body;

        // Validate rawBody is available
        if (!rawBody) {
            this.logger.error('❌ rawBody is missing');
            throw new Error('Raw body not available');
        }

        // Debug logging
        this.logger.debug(`Signature header present: ${!!signature}, rawBody length: ${rawBody?.length}`);

        // Verify Persona webhook signature
        if (!this.personaService.verifyWebhookSignature(rawBody, signature)) {
            this.logger.warn('❌ Webhook signature verification failed');
            throw new Error('Invalid webhook signature');
        }

        // Log successful verification
        const eventName = payload?.data?.attributes?.name || 'unknown';
        this.logger.log(`✅ Verified Persona webhook: ${eventName}`);

        // Continue with normal webhook processing
        return this.kycService.handleWebhook(rawBody, signature || '', payload);
    }
}
