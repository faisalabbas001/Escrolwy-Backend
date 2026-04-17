import {
  Controller,
  Post,
  Get,
  Body,
  Param,
} from '@nestjs/common';
import {
  ServiceOnly,
} from '@escrowly/auth-common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto, ReservationResponseDto } from './dto';
import {
  ApiCreateReservation,
  ApiGetReservation,
  ApiReleaseReservation,
  ApiCancelReservation,
} from './docs/reservation.swagger';
import { ReservationApiTag } from './docs/reservation.tags';

/**
 * Reservation Controller
 *
 * Single Responsibility: Handles HTTP requests for reservations
 * Follows Single Responsibility Principle (SRP)
 * 
 * IMPORTANT: These endpoints are INTERNAL ONLY - accessible only by other services
 * via service API key authentication. Regular users cannot access these endpoints.
 */
@ReservationApiTag()
@Controller({
  path: 'ledger/reservations',
  version: '1',
})
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * Create a new reservation
   * INTERNAL API: Only accessible by other services with service API key
   */
  @ApiCreateReservation()
  @ServiceOnly()
  @Post()
  async createReservation(
    @Body() createReservationDto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    return this.reservationService.createReservation(createReservationDto);
  }

  /**
   * Get reservation by ID
   * INTERNAL API: Only accessible by other services with service API key
   */
  @ApiGetReservation()
  @ServiceOnly()
  @Get(':id')
  async getReservation(
    @Param('id') id: string,
  ): Promise<ReservationResponseDto> {
    return this.reservationService.getReservation(id);
  }

  /**
   * Release reservation (move to escrow holding pool)
   * INTERNAL API: Only accessible by other services with service API key
   */
  @ApiReleaseReservation()
  @ServiceOnly()
  @Post(':id/release')
  async releaseReservation(
    @Param('id') id: string,
    @Body() body: { escrowHoldingPoolAccountId?: string },
  ): Promise<ReservationResponseDto> {
    // TODO: Get escrow holding pool account ID from system accounts
    const escrowHoldingPoolAccountId = body.escrowHoldingPoolAccountId || 'system-escrow-pool';
    return this.reservationService.releaseReservation(id, escrowHoldingPoolAccountId);
  }

  /**
   * Cancel reservation (move back to spendable)
   * INTERNAL API: Only accessible by other services with service API key
   */
  @ApiCancelReservation()
  @ServiceOnly()
  @Post(':id/cancel')
  async cancelReservation(
    @Param('id') id: string,
  ): Promise<ReservationResponseDto> {
    return this.reservationService.cancelReservation(id);
  }
}

