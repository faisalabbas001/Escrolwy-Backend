import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppStatusDtoDocs } from '../dto/docs/app-status.dto.docs';

/**
 * Decorator for Service Status endpoint
 * GET /
 */
export function ApiServiceStatus() {
  return applyDecorators(
    ApiOperation({
      summary: 'Service status',
      description: 'Check if the Escrow service is running',
    }),
    ApiResponse({
      status: 200,
      description: 'Service is running',
      type: AppStatusDtoDocs,
    }),
  );
}
