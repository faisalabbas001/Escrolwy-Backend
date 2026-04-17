import { applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Tag decorator for Transfer API
 * Groups all transfer-related endpoints
 */
export function TransferApiTag() {
  return applyDecorators(ApiTags('transfers'));
}

