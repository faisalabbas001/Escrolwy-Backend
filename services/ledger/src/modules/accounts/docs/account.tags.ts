import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Tag decorator for Account API
 * Groups all account-related endpoints
 */
export function AccountApiTag() {
  return applyDecorators(ApiTags('accounts'));
}

