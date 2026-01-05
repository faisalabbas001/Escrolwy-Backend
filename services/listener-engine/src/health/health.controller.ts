import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService, HealthCheckResponse, ListenerHealthSummary } from './health.service';

/**
 * Health Controller
 *
 * Provides health check endpoints for the listener-engine service.
 * Used by load balancers, Kubernetes, and monitoring systems.
 */
@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Comprehensive health check
   * Returns detailed status of all components
   */
  @Get()
  @ApiOperation({ summary: 'Get detailed health status' })
  @ApiResponse({
    status: 200,
    description: 'Health check response',
  })
  async check(): Promise<HealthCheckResponse> {
    return this.healthService.check();
  }

  /**
   * Liveness probe
   * Used by Kubernetes to determine if the container should be restarted
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness(): { status: 'ok' } {
    return this.healthService.liveness();
  }

  /**
   * Readiness probe
   * Used by Kubernetes to determine if the container can receive traffic
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    const result = await this.healthService.readiness();
    return result;
  }

  /**
   * Listener-specific status
   * Returns detailed listener status including lag and mode
   */
  @Get('listener')
  @ApiOperation({ summary: 'Get listener status' })
  @ApiResponse({
    status: 200,
    description: 'Listener status',
  })
  async listenerStatus(): Promise<{
    chains: string[];
    listener: ListenerHealthSummary;
  }> {
    const health = await this.healthService.check();
    return {
      chains: health.chains,
      listener: health.checks.listener,
    };
  }
}

