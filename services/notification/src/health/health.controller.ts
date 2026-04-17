import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "@escrowly/auth-common";
import { HealthService } from "./health.service";

/**
 * Health Check Controller
 *
 * Provides endpoints to monitor service health and readiness.
 * Used by load balancers and monitoring systems.
 */
@ApiTags("health")
@Controller({
  path: "health",
  version: "1",
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check
   * Returns 200 if service is running
   */
  @Public()
  @Get()
  @ApiOperation({ summary: "Health check" })
  @ApiResponse({
    status: 200,
    description: "Service is healthy",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        service: { type: "string", example: "notification-service" },
        timestamp: { type: "string", example: "2025-12-11T08:00:00.000Z" },
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
  @Public()
  @Get("ready")
  @ApiOperation({ summary: "Readiness check" })
  @ApiResponse({
    status: 200,
    description: "Service is ready",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ready" },
        service: { type: "string", example: "notification-service" },
        database: { type: "string", example: "connected" },
        timestamp: { type: "string", example: "2025-12-11T08:00:00.000Z" },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "Service not ready",
  })
  async ready() {
    return this.healthService.ready();
  }
}

