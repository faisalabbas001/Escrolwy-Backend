import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { JwtService } from '../auth/jwt.service';
import {
  IssueServiceTokenDto,
  ValidateTokenResponseDto,
  IssueServiceTokenResponseDto,
  GetEmailsByIdsDto,
  GetEmailsByIdsResponseDto,
} from './dto';

/**
 * Internal Service
 *
 * Handles internal service-to-service operations
 */
@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Validate token and return claims
   */
  async validateToken(token: string): Promise<ValidateTokenResponseDto> {
    const payload = this.jwtService.validateToken(token);

    if (!payload) {
      return { valid: false };
    }

    return {
      valid: true,
      sub: payload.sub,
      role: payload.role,
      scopes: payload.scopes,
      exp: payload.exp,
    };
  }

  /**
   * Issue service-to-service token
   */
  async issueServiceToken(
    dto: IssueServiceTokenDto,
  ): Promise<IssueServiceTokenResponseDto> {
    const ttl = dto.ttl_sec || 600;
    const token = this.jwtService.generateServiceToken(
      dto.aud,
      dto.scopes,
      ttl,
    );

    this.logger.log(
      `Issued S2S token for ${dto.aud} with scopes: ${dto.scopes.join(', ')}`,
    );

    return {
      token,
      expires_in: ttl,
    };
  }

  /**
   * Get emails by user IDs
   * Returns a mapping of user IDs to emails for the provided user IDs
   */
  async getEmailsByIds(
    dto: GetEmailsByIdsDto,
  ): Promise<GetEmailsByIdsResponseDto> {
    this.logger.debug(`Fetching emails for ${dto.user_ids.length} user IDs`);

    // Remove duplicates and filter out invalid UUIDs
    const uniqueIds = [...new Set(dto.user_ids)];

    if (uniqueIds.length === 0) {
      return { emails: {} };
    }

    // Fetch users by IDs
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
        deletedAt: null, // Only return non-deleted users
      },
      select: {
        id: true,
        email: true,
      },
    });

    // Create mapping of user ID to email
    const emails: Record<string, string> = {};
    for (const user of users) {
      emails[user.id] = user.email;
    }

    this.logger.debug(
      `Found ${users.length} emails out of ${uniqueIds.length} requested IDs`,
    );

    return { emails };
  }
}
