import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Tag decorator for Reservation API
 * Groups all reservation-related endpoints
 */
export function ReservationApiTag() {
  return applyDecorators(ApiTags('reservations'));
}

