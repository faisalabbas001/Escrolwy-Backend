import { applyDecorators, HttpCode } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
} from '@nestjs/swagger';
import {
  CreateTransferDtoDocs,
  TransferResponseDtoDocs,
} from '../dto/docs/transfer.dto.docs';

/**
 * Create Transfer endpoint
 * POST /ledger/transfers
 * @requires Role.USER
 */
export function ApiCreateTransfer() {
  return applyDecorators(
    HttpCode(201),
    ApiBearerAuth('access_token'),
    ApiBody({
      type: CreateTransferDtoDocs,
      description: 'Transfer creation request payload',
    }),
    ApiOperation({
      summary: 'Create transfer',
      description:
        'Creates a new transfer (internal or external). Validates balance sufficiency, creates journal and entries, and emits Kafka events. **Requires USER role.**',
    }),
    ApiResponse({
      status: 201,
      description: 'Transfer created successfully',
      type: TransferResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid input data or insufficient balance',
    }),
    ApiResponse({
      status: 409,
      description: 'Duplicate transfer (idempotency key already exists)',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
  );
}

/**
 * Get Transfer by ID endpoint
 * GET /ledger/transfers/:id
 * @requires Authentication
 */
export function ApiGetTransfer() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiParam({
      name: 'id',
      description: 'Transfer ID',
      type: String,
      example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    ApiOperation({
      summary: 'Get transfer details',
      description:
        'Retrieves detailed information about a specific transfer including journal and entries. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Transfer retrieved successfully',
      type: TransferResponseDtoDocs,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiResponse({
      status: 404,
      description: 'Transfer not found',
    }),
  );
}

