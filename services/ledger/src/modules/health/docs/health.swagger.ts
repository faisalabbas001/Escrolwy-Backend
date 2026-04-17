import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

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
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'healthy' },
          timestamp: { type: 'string', example: '2025-12-11T10:30:00Z' },
          uptime: { type: 'number', example: 3600 },
          service: { type: 'string', example: 'ledger' },
        },
      },
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
      schema: {
        type: 'object',
        properties: {
          ready: { type: 'boolean', example: true },
          timestamp: { type: 'string', example: '2025-12-11T10:30:00Z' },
          checks: {
            type: 'object',
            properties: {
              memory: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  heapUsed: { type: 'string', example: '50 MB' },
                  heapTotal: { type: 'string', example: '100 MB' },
                },
              },
              process: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'ok' },
                  pid: { type: 'number', example: 12345 },
                  uptime: { type: 'string', example: '3600 seconds' },
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 503,
      description: 'Service is not ready',
    }),
  );
}

