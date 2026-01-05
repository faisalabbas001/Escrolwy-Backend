import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthStatusDtoDocs } from '../dto/docs/health-status.dto.docs';
import { HealthCheckDtoDocs } from '../dto/docs/health-check.dto.docs';

/**
 * Decorator for Health Check endpoint
 * GET /health
 */
export function ApiHealthCheck() {
  return applyDecorators(
    HttpCode(200),
    ApiOperation({
      summary: 'Health check',
      description: 'Check if the service is healthy and running',
    }),
    ApiResponse({
      status: 200,
      description: 'Service is healthy',
      type: HealthStatusDtoDocs,
    }),
    ApiResponse({
      status: 503,
      description: 'Service is unhealthy',
    }),
  );
}

/**
 * Decorator for Readiness Check endpoint
 * GET /health/ready
 */
export function ApiHealthReady() {
  return applyDecorators(
    HttpCode(200),
    ApiOperation({
      summary: 'Readiness check',
      description: 'Check if the service is ready to handle requests',
    }),
    ApiResponse({
      status: 200,
      description: 'Service is ready',
      type: HealthCheckDtoDocs,
    }),
    ApiResponse({
      status: 503,
      description: 'Service is not ready',
    }),
  );
}
