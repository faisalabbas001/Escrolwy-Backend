import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
  Headers,
} from '@nestjs/common';
import {
  Roles,
  CurrentUser,
  Role,
  AuthUser,
  Public,
} from '@escrowly/auth-common';
import { EscrowService } from './escrow.service';
import {
  CreateEscrowDto,
  AcceptEscrowDto,
  CancelEscrowDto,
} from './dto/create-escrow.dto';
import {
  ProcessPaymentDto,
  RecordDeliveryDto,
  RecordInspectionDto,
  FileDisputeDto,
  ResolveDisputeDto,
  AdminForceCloseDto,
} from './dto/escrow-operations.dto';
import {
  ApiCreateEscrow,
  ApiGetEscrow,
  ApiGetMyEscrows,
  ApiGetUserEscrows,
  ApiAcceptEscrow,
  ApiCancelEscrow,
  ApiProcessPayment,
  ApiRecordDelivery,
  ApiRecordInspection,
  ApiFileDispute,
  ApiGetEscrowHistory,
  ApiGetAllEscrows,
  ApiGetStatistics,
  ApiResolveDispute,
  ApiAdminForceClose,
} from './docs/escrow.swagger';
import { EscrowApiTag } from './docs/escrow.tags';

/**
 * Escrow Controller
 *
 * Handles all escrow-related HTTP requests.
 * Protected by JwtAuthGuard globally - use @Public() for public routes.
 * Role-based access via @Roles() decorator.
 *
 * Route order matters! Static routes (me, all, statistics) must come before
 * dynamic routes (:id) to avoid conflicts.
 */
@EscrowApiTag()
@Controller({
  path: 'escrows',
  version: '1',
})
export class EscrowController {
  private readonly logger = new Logger(EscrowController.name);

  constructor(private readonly escrowService: EscrowService) {}

  // ==========================================
  // Static routes (must come before :id routes)
  // ==========================================

  /**
   * Get current user's escrows
   * Returns all escrows where user is buyer or seller
   */
  @ApiGetMyEscrows()
  @Get('me')
  async getMyEscrows(@CurrentUser('id') userId: string) {
    return this.escrowService.getUserEscrows(userId);
  }

  /**
   * Get all escrows (Admin only)
   * Only super admins can view all escrows
   */
  @ApiGetAllEscrows()
  @Roles(Role.SUPER_ADMIN)
  @Get('all')
  async getAllEscrows(
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50,
  ) {
    return this.escrowService.getAllEscrows(skip, take);
  }

  /**
   * Get platform statistics (Admin only)
   * Only super admins can view statistics
   */
  @ApiGetStatistics()
  @Roles(Role.SUPER_ADMIN)
  @Get('statistics')
  async getStatistics() {
    return this.escrowService.getStatistics();
  }

  /**
   * Get specific user's escrows (Admin only)
   * Admins can view any user's escrows
   */
  @ApiGetUserEscrows()
  @Roles(Role.SUPER_ADMIN)
  @Get('user/:userId')
  async getUserEscrows(@Param('userId') userId: string) {
    return this.escrowService.getUserEscrows(userId);
  }

  // ==========================================
  // Dynamic routes (:id)
  // ==========================================

  /**
   * Create a new escrow
   * Only authenticated users can create escrows
   */
  @ApiCreateEscrow()
  @Roles(Role.USER)
  @Post()
  async createEscrow(
    @Body() createEscrowDto: CreateEscrowDto,
    @CurrentUser('id') userId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    // Extract JWT token from authorization header
    const jwtToken = authHeader || undefined;
    return this.escrowService.createEscrow(createEscrowDto, userId, jwtToken);
  }

      /**
   * Accept escrow agreement
   * Only the other party (buyer/seller) can accept
   */
      @ApiAcceptEscrow()
      @Roles(Role.USER)
      @Post(':id/accept')
      async acceptEscrow(
        @Param('id') id: string,
        @Body() acceptDto: AcceptEscrowDto,
        @CurrentUser('id') userId: string,
        @Headers('authorization') authHeader?: string,
      ) {
            // TODO: Replace with actual user ID from auth when authentication is enabled
        // const userId = '33333333-3333-4333-8333-333333333333';
        const jwtToken = authHeader || undefined;
        return this.escrowService.acceptEscrow(id, userId, acceptDto, jwtToken);
      }


  /**
   * Process payment
   * Buyer or seller can process payment depending on fee payment model:
   * - If buyer pays all fees: buyer pays once (escrow amount + fees)
   * - If seller pays fees: buyer pays escrow amount, then seller pays fees
   * - If fees split: buyer pays escrow + buyer fee, then seller pays seller fee
   */
  @ApiProcessPayment()
  @Roles(Role.USER)
  @Post(':id/payment')
  async processPayment(
    @Param('id') id: string,
    @Body() paymentDto: ProcessPaymentDto,
    @CurrentUser('id') userId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const jwtToken = authHeader || undefined;
    return this.escrowService.recordPayment(
      id,
      userId,
      paymentDto.amount,
      jwtToken,
    );
  }


  /**
   * Record delivery
   * Only the seller can record delivery
   */
  @ApiRecordDelivery()
  @Roles(Role.USER)
  @Post(':id/delivery')
  async recordDelivery(
    @Param('id') id: string,
    @Body() deliveryDto: RecordDeliveryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.escrowService.recordDelivery(
      id,
      userId,
      deliveryDto.deliveryProof,
      deliveryDto.notes,
    );
  }

  /**
   * Record inspection
   * Only the buyer can record inspection results
   */
  @ApiRecordInspection()
  @Roles(Role.USER)
  @Post(':id/inspection')
  async recordInspection(
    @Param('id') id: string,
    @Body() inspectionDto: RecordInspectionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.escrowService.recordInspection(
      id,
      userId,
      inspectionDto.inspectionNotes,
    );
  }

  /**
   * Complete escrow
   * Only buyer can complete
   */
  @Post(':id/complete')
  async completeEscrow(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.escrowService.completeEscrow(id, userId);
  }

  /**
   * Get escrow by ID
   * Authenticated users can view escrow details
   */
  @ApiGetEscrow()
  @Get(':id')
  async getEscrow(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    // TODO: Add authorization check - only parties involved or admins can view
    return this.escrowService.getEscrow(id);
  }


  

  /**
   * Get escrow history
   * Parties involved or admins can view history
   */
  @ApiGetEscrowHistory()
  @Get(':id/history')
  async getEscrowHistory(
    @Param('id') id: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50,
  ) {
    
    return this.escrowService.getEscrowHistory(id, skip, take);
  }




  /**
   * Cancel escrow
   * Only parties involved or admins can cancel
   */
  @ApiCancelEscrow()
  @Roles(Role.USER)
  @Post(':id/cancel')
  async cancelEscrow(
    @Param('id') id: string,
    @Body() cancelDto: CancelEscrowDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.escrowService.cancelEscrow(id, userId, cancelDto.reason);
  }







  /**
   * File dispute
   * Either party can file a dispute
   */
  @ApiFileDispute()
  @Roles(Role.USER)
  @Post(':id/dispute')
  async fileDispute(
    @Param('id') id: string,
    @Body() disputeDto: FileDisputeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.escrowService.fileDispute(
      id,
      userId,
      disputeDto.reason,
      disputeDto.evidence,
    );
  }

  // ==========================================
  // Admin-only routes
  // ==========================================

  /**
   * Resolve dispute (Admin only)
   * Admin determines outcome: buyer_wins, seller_wins, or refund
   */
  @ApiResolveDispute()
  @Roles(Role.SUPER_ADMIN)
  @Post(':id/resolve')
  async resolveDispute(
    @Param('id') id: string,
    @Body() resolveDto: ResolveDisputeDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.escrowService.resolveDispute(
      id,
      adminId,
      resolveDto.resolution,
      resolveDto.adminNotes,
    );
  }

  /**
   * Force close escrow (Admin only)
   * Admin can close escrow in any state (emergency action)
   */
  @ApiAdminForceClose()
  @Roles(Role.SUPER_ADMIN)
  @Post(':id/force-close')
  async adminForceClose(
    @Param('id') id: string,
    @Body() forceCloseDto: AdminForceCloseDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.escrowService.adminForceClose(
      id,
      adminId,
      forceCloseDto.reason,
      forceCloseDto.fundsAction,
    );
  }
}
