import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Tag decorator for App API
 * Groups all app endpoints under a single tag in Swagger
 */
export function AppApiTag() {
  return applyDecorators(ApiTags('app'));
}
