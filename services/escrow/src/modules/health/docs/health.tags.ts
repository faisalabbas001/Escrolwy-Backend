import { applyDecorators, Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Tag decorator for Health Check API
 * Groups all health check endpoints under a single tag in Swagger
 */
export function HealthCheckApiTag() {
  return applyDecorators(ApiTags('health'));
}
