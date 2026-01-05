import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@escrowly/auth-common';
import { HealthService } from './health.service';

/**
 * Health Check Controller
 *
 * Provides endpoints to monitor service health and readiness.
 * Used by load balancers and monitoring systems.
 * All health endpoints are public (no authentication required).
 */
@ApiTags('health')
@Public()
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check
   * Returns 200 if service is running
   */
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'auth-service' },
        timestamp: { type: 'string', example: '2025-11-19T08:00:00.000Z' },
      },
    },
  })
  check() {
    return this.healthService.check();
  }

  /**
   * Readiness check
   * Returns 200 if service is ready to accept traffic
   * Checks database connectivity
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready',
  })
  async ready() {
    return this.healthService.ready();
  }

  /**
   * Liveness check
   * Returns 200 if service is alive (even if not ready)
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
  })
  live() {
    return this.healthService.live();
  }
}
