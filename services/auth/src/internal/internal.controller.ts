import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Public } from '@escrowly/auth-common';
import { InternalService } from './internal.service';
import { ServiceAuthGuard } from '../guards/service-auth.guard';
import {
  IssueServiceTokenDto,
  ValidateTokenResponseDto,
  IssueServiceTokenResponseDto,
  GetEmailsByIdsDto,
  GetEmailsByIdsResponseDto,
} from './dto';

/**
 * Internal Controller
 *
 * Internal service-to-service endpoints:
 * - POST /internal/auth/validate - Validates access/refresh token and returns user claims
 * - POST /internal/auth/s2s/issue - Issues short-lived JWT for internal calls
 * - POST /internal/auth/users/emails - Get emails by user IDs
 *
 * All endpoints are protected by ServiceAuthGuard (x-service-token header)
 * Uses @Public() to bypass global JwtAuthGuard
 */
@Controller({ path: 'internal/auth', version: '1' })
@ApiTags('Internal (Service-to-Service)')
@UseGuards(ServiceAuthGuard)
@Public() // Bypass global JwtAuthGuard, we use service token instead
@ApiHeader({
  name: 'x-service-token',
  description: 'Service-to-service authentication token',
  required: true,
})
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(private readonly internalService: InternalService) { }

  /**
   * Validate access/refresh token and return user claims
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate access/refresh token',
    description: 'Validates an access or refresh token and returns user claims if valid',
  })
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token to validate',
    required: true,
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: ValidateTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid service token or missing authorization header' })
  async validateToken(
    @Headers('authorization') authHeader: string,
  ): Promise<ValidateTokenResponseDto> {
    this.logger.debug('Internal token validation request');

    // Extract token from Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    return this.internalService.validateToken(token);
  }

  /**
   * Issue a short-lived JWT for internal service-to-service calls
   */
  @Post('s2s/issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue service-to-service token',
    description: 'Issues a short-lived JWT for internal service calls with specific scopes',
  })
  @ApiResponse({
    status: 200,
    description: 'S2S token issued successfully',
    type: IssueServiceTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid service token' })
  async issueServiceToken(
    @Body() dto: IssueServiceTokenDto,
  ): Promise<IssueServiceTokenResponseDto> {
    this.logger.debug(`S2S token issue request for audience: ${dto.aud}`);
    return this.internalService.issueServiceToken(dto);
  }

  /**
   * Get emails by user IDs
   */
  @Post('users/emails')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get emails by user IDs',
    description: 'Returns a mapping of user IDs to emails for the provided user IDs',
  })
  @ApiResponse({
    status: 200,
    description: 'Emails retrieved successfully',
    type: GetEmailsByIdsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid service token' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async getEmailsByIds(
    @Body() dto: GetEmailsByIdsDto,
  ): Promise<GetEmailsByIdsResponseDto> {
    this.logger.debug(`Get emails request for ${dto.user_ids.length} user IDs`);
    return this.internalService.getEmailsByIds(dto);
  }
}
