import {
  Controller,
  Get,
  Query,
  Param,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { PayoutResponseDto, PaginatedPayoutsResponseDto } from './dto';

/**
 * Payouts Controller
 *
 * Read-only API for querying payout requests.
 * Does NOT expose payout_attempts (internal audit only).
 */
@ApiTags('payouts')
@Controller({ path: 'payouts', version: '1' })
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  /**
   * Get payouts by user ID
   */
  @Get()
  @ApiOperation({
    summary: 'Get payouts by user ID',
    description: 'Returns paginated list of payout requests for a user',
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: ['pending', 'fulfilled', 'failed'],
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of payouts',
    type: PaginatedPayoutsResponseDto,
  })
  async getPayouts(
    @Query('user_id', ParseUUIDPipe) userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ): Promise<PaginatedPayoutsResponseDto> {
    // Validate and set defaults
    const pageNum = Math.max(1, page || 1);
    const limitNum = Math.min(100, Math.max(1, limit || 20));

    return this.payoutsService.getPayoutsByUserId(userId, pageNum, limitNum, status);
  }

  /**
   * Get a single payout by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get payout by ID',
    description: 'Returns a single payout request by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Payout request UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payout details',
    type: PayoutResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payout not found',
  })
  async getPayoutById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PayoutResponseDto> {
    const payout = await this.payoutsService.getPayoutById(id);

    if (!payout) {
      throw new NotFoundException(`Payout ${id} not found`);
    }

    return payout;
  }
}

