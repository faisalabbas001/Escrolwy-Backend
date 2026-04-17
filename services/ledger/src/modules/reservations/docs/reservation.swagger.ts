import { applyDecorators, HttpCode } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
} from '@nestjs/swagger';
import {
  CreateReservationDtoDocs,
  ReservationResponseDtoDocs,
} from '../dto/docs/reservation.dto.docs';

/**
 * Create Reservation endpoint
 * POST /ledger/reservations
 * @requires Role.USER
 */
export function ApiCreateReservation() {
  return applyDecorators(
    HttpCode(201),
    ApiBearerAuth('access_token'),
    ApiBody({
      type: CreateReservationDtoDocs,
      description: 'Reservation creation request payload',
    }),
    ApiOperation({
      summary: 'Create reservation',
      description:
        'Reserves funds from user spendable account to reserved account. Used for escrow operations. **Requires USER role.**',
    }),
    ApiResponse({
      status: 201,
      description: 'Reservation created successfully',
      type: ReservationResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid input data or insufficient balance',
    }),
    ApiResponse({
      status: 409,
      description: 'Duplicate reservation (idempotency key already exists)',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
  );
}

/**
 * Get Reservation by ID endpoint
 * GET /ledger/reservations/:id
 */
export function ApiGetReservation() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiParam({
      name: 'id',
      description: 'Reservation ID',
      type: String,
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOperation({
      summary: 'Get reservation details',
      description: 'Retrieves detailed information about a specific reservation. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Reservation retrieved successfully',
      type: ReservationResponseDtoDocs,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiResponse({
      status: 404,
      description: 'Reservation not found',
    }),
  );
}

/**
 * Release Reservation endpoint
 * POST /ledger/reservations/:id/release
 */
export function ApiReleaseReservation() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiParam({
      name: 'id',
      description: 'Reservation ID',
      type: String,
    }),
    ApiOperation({
      summary: 'Release reservation',
      description: 'Releases reserved funds to escrow holding pool. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Reservation released successfully',
      type: ReservationResponseDtoDocs,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiResponse({
      status: 404,
      description: 'Reservation not found',
    }),
    ApiResponse({
      status: 400,
      description: 'Reservation is not in reserved status',
    }),
  );
}

/**
 * Cancel Reservation endpoint
 * POST /ledger/reservations/:id/cancel
 */
export function ApiCancelReservation() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiParam({
      name: 'id',
      description: 'Reservation ID',
      type: String,
    }),
    ApiOperation({
      summary: 'Cancel reservation',
      description: 'Cancels reservation and moves funds back to spendable account. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Reservation cancelled successfully',
      type: ReservationResponseDtoDocs,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiResponse({
      status: 404,
      description: 'Reservation not found',
    }),
    ApiResponse({
      status: 400,
      description: 'Reservation cannot be cancelled',
    }),
  );
}

