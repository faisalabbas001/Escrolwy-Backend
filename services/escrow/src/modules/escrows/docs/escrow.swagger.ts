import { applyDecorators, HttpCode } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import {
  EscrowResponseDtoDocs,
  EscrowTransitionDtoDocs,
} from '../dto/docs/escrow.dto.docs';
import {
  CreateEscrowDtoDocs,
  ProcessPaymentDtoDocs,
  RecordDeliveryDtoDocs,
  RecordInspectionDtoDocs,
  FileDisputeDtoDocs,
} from '../dto/docs/escrow-operations.dto.docs';

/**
 * Common auth responses for protected endpoints
 */
const AuthResponses = () =>
  applyDecorators(
    ApiBearerAuth('access_token'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
  );

/**
 * Auth responses with role requirement
 */
const AuthWithRoleResponses = () =>
  applyDecorators(
    ApiBearerAuth('access_token'),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Insufficient permissions (role required)',
    }),
  );

/**
 * Create Escrow endpoint
 * POST /escrows
 * @requires Role.USER
 */
export function ApiCreateEscrow() {
  return applyDecorators(
    HttpCode(201),
    ApiBearerAuth('access_token'),
    ApiBody({
      type: CreateEscrowDtoDocs,
      description: 'Escrow creation request payload',
    }),
    ApiOperation({
      summary: 'Create new escrow',
      description:
        'Creates a new escrow agreement between buyer and seller. Initial state is "agreement". **Requires USER role.**',
    }),
    ApiResponse({
      status: 201,
      description: 'Escrow created successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid input data',
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
 * Get Escrow by ID endpoint
 * GET /escrows/:id
 * @requires Authentication
 */
export function ApiGetEscrow() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiOperation({
      summary: 'Get escrow details',
      description:
        'Retrieves detailed information about a specific escrow. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrow retrieved successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Get My Escrows endpoint
 * GET /escrows/me
 * @requires Authentication
 */
export function ApiGetMyEscrows() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiOperation({
      summary: 'Get my escrows',
      description:
        'Retrieves all escrows where the authenticated user is buyer or seller. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrows retrieved successfully',
      type: [EscrowResponseDtoDocs],
      isArray: true,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
  );
}

/**
 * Get User Escrows endpoint (Admin)
 * GET /escrows/user/:userId
 * @requires Role.SUPER_ADMIN
 */
export function ApiGetUserEscrows() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiOperation({
      summary: 'Get user escrows (Admin)',
      description:
        'Retrieves all escrows for a specific user. **Requires SUPER_ADMIN role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrows retrieved successfully',
      type: [EscrowResponseDtoDocs],
      isArray: true,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires SUPER_ADMIN role',
    }),
  );
}

/**
 * Accept Escrow endpoint
 * POST /escrows/:id/accept
 * @requires Role.USER
 */
export function ApiAcceptEscrow() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            minLength: 10,
            maxLength: 500,
            description: 'Reason for accepting the escrow',
          },
        },
      },
      description: 'Accept escrow request payload',
    }),
    ApiOperation({
      summary: 'Accept escrow agreement',
      description:
        'Seller accepts the escrow agreement. **Requires USER role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrow accepted successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid state or unauthorized',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Cancel Escrow endpoint
 * POST /escrows/:id/cancel
 * @requires Role.USER
 */
export function ApiCancelEscrow() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            minLength: 10,
            maxLength: 500,
            description: 'Reason for cancelling the escrow',
          },
        },
        required: ['reason'],
      },
      description: 'Cancel escrow request payload',
    }),
    ApiOperation({
      summary: 'Cancel escrow',
      description:
        'Cancels an escrow in agreement or funded state. **Requires USER role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrow cancelled successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Cannot cancel in current state',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Process Payment endpoint
 * POST /escrows/:id/payment
 * @requires Role.USER
 */
export function ApiProcessPayment() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      type: ProcessPaymentDtoDocs,
      description: 'Payment processing request payload',
    }),
    ApiOperation({
      summary: 'Process escrow payment',
      description:
        'Buyer funds the escrow. Transitions state from "agreement" to "funded". **Requires USER role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Payment processed successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid payment amount or state',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Record Delivery endpoint
 * POST /escrows/:id/delivery
 * @requires Role.USER
 */
export function ApiRecordDelivery() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      type: RecordDeliveryDtoDocs,
      description: 'Delivery recording request payload',
    }),
    ApiOperation({
      summary: 'Record delivery',
      description:
        'Seller confirms delivery of goods. Transitions from "funded" to "delivery". **Requires USER role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Delivery recorded successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid state or unauthorized',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Record Inspection endpoint
 * POST /escrows/:id/inspection
 * @requires Role.USER
 */
export function ApiRecordInspection() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      type: RecordInspectionDtoDocs,
      description: 'Inspection recording request payload',
    }),
    ApiOperation({
      summary: 'Record inspection result',
      description:
        'Buyer inspects goods. Accepted → closed, Rejected → disputed. **Requires USER role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Inspection recorded successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Invalid state or unauthorized',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * File Dispute endpoint
 * POST /escrows/:id/dispute
 * @requires Role.USER
 */
export function ApiFileDispute() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      type: FileDisputeDtoDocs,
      description: 'Dispute filing request payload',
    }),
    ApiOperation({
      summary: 'File dispute',
      description:
        'Buyer or seller files a dispute during delivery or inspection. **Requires USER role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Dispute filed successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Cannot dispute in current state',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires USER role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Get Escrow History endpoint
 * GET /escrows/:id/history
 * @requires Authentication
 */
export function ApiGetEscrowHistory() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiOperation({
      summary: 'Get escrow history',
      description:
        'Retrieves complete audit trail of escrow state transitions. **Requires authentication.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrow history retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/EscrowTransitionDtoDocs' },
          },
          total: { type: 'number' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Get All Escrows (Admin) endpoint
 * GET /escrows/all
 * @requires Role.SUPER_ADMIN
 */
export function ApiGetAllEscrows() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiOperation({
      summary: 'Get all escrows (Admin)',
      description:
        'Retrieves all escrows with pagination. **Requires SUPER_ADMIN role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrows retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/EscrowResponseDtoDocs' },
          },
          total: { type: 'number' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires SUPER_ADMIN role',
    }),
  );
}

/**
 * Get Escrow Statistics endpoint
 * GET /escrows/statistics
 * @requires Role.SUPER_ADMIN
 */
export function ApiGetStatistics() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiOperation({
      summary: 'Get escrow statistics',
      description:
        'Retrieves count of escrows in each state. **Requires SUPER_ADMIN role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Statistics retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          agreement: { type: 'number' },
          funded: { type: 'number' },
          delivery: { type: 'number' },
          inspection: { type: 'number' },
          closed: { type: 'number' },
          disputed: { type: 'number' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires SUPER_ADMIN role',
    }),
  );
}

/**
 * Resolve Dispute endpoint (Admin)
 * POST /escrows/:id/resolve
 * @requires Role.SUPER_ADMIN
 */
export function ApiResolveDispute() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['resolution', 'adminNotes'],
        properties: {
          resolution: {
            type: 'string',
            enum: ['buyer_wins', 'seller_wins', 'refund'],
            description: 'Resolution outcome',
            example: 'buyer_wins',
          },
          adminNotes: {
            type: 'string',
            description: 'Admin notes explaining the decision',
            example: 'Evidence supports buyer claim. Issuing full refund.',
          },
        },
      },
      description: 'Dispute resolution payload',
    }),
    ApiOperation({
      summary: 'Resolve dispute (Admin)',
      description:
        'Admin resolves a disputed escrow. Determines outcome: buyer_wins (refund buyer), seller_wins (release to seller), or refund (full refund). **Requires SUPER_ADMIN role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Dispute resolved successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Escrow not in disputed state',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires SUPER_ADMIN role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}

/**
 * Admin Force Close endpoint
 * POST /escrows/:id/force-close
 * @requires Role.SUPER_ADMIN
 */
export function ApiAdminForceClose() {
  return applyDecorators(
    HttpCode(200),
    ApiBearerAuth('access_token'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for force closing',
            example: 'Fraudulent activity detected',
          },
          fundsAction: {
            type: 'string',
            enum: ['refund_buyer', 'release_seller', 'no_action'],
            description: 'Action to take with escrowed funds',
            example: 'refund_buyer',
          },
        },
      },
      description: 'Force close payload',
    }),
    ApiOperation({
      summary: 'Force close escrow (Admin)',
      description:
        'Admin force closes an escrow in any state. Emergency action for fraud, expired disputes, etc. **Requires SUPER_ADMIN role.**',
    }),
    ApiResponse({
      status: 200,
      description: 'Escrow force closed successfully',
      type: EscrowResponseDtoDocs,
    }),
    ApiResponse({
      status: 400,
      description: 'Escrow already closed',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing access token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Requires SUPER_ADMIN role',
    }),
    ApiResponse({
      status: 404,
      description: 'Escrow not found',
    }),
  );
}
