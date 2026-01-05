import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Tag decorator for Escrow API
 * Groups all escrow-related endpoints
 */
export function EscrowApiTag() {
  return applyDecorators(ApiTags('escrows'));
}

/**
 * Tag decorator for Admin Escrow API
 * Groups admin-only escrow endpoints
 */
export function AdminEscrowApiTag() {
  return applyDecorators(ApiTags('admin'));
}
