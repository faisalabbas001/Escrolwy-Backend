import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { PayoutResponseDto, PaginatedPayoutsResponseDto } from './dto';

/**
 * Payouts Service
 *
 * Handles payout queries and data transformation.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get payouts by user ID with pagination
   */
  async getPayoutsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<PaginatedPayoutsResponseDto> {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [payouts, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);

    return {
      data: payouts.map((p) => this.toPayoutResponse(p)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single payout by ID
   */
  async getPayoutById(id: string): Promise<PayoutResponseDto | null> {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id },
    });

    if (!payout) {
      return null;
    }

    return this.toPayoutResponse(payout);
  }

  /**
   * Transform Prisma model to response DTO
   */
  private toPayoutResponse(payout: any): PayoutResponseDto {
    return {
      id: payout.id,
      userId: payout.userId,
      chain: payout.chain,
      asset: payout.asset,
      amount: payout.amount.toString(),
      destinationAddress: payout.destinationAddress,
      status: payout.status,
      txHash: payout.txHash || undefined,
      blockNumber: payout.blockNumber ? Number(payout.blockNumber) : undefined,
      gasUsed: payout.gasUsed?.toString() || undefined,
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
    };
  }
}

