import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * Limits Repository
 *
 * Handles database operations for user limits.
 */
@Injectable()
export class LimitsRepository {
    private readonly logger = new Logger(LimitsRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get limits for a user
     */
    async findByUserId(userId: string) {
        return this.prisma.userLimit.findUnique({
            where: { userId },
        });
    }

    /**
     * Get escrow limit for a user
     */
    async getEscrowLimit(userId: string): Promise<number | null> {
        const limits = await this.prisma.userLimit.findUnique({
            where: { userId },
            select: { escrowLimit: true },
        });
        return limits ? Number(limits.escrowLimit) : null;
    }

    /**
     * Get ledger limit for a user
     */
    async getLedgerLimit(userId: string): Promise<number | null> {
        const limits = await this.prisma.userLimit.findUnique({
            where: { userId },
            select: { ledgerLimit: true },
        });
        return limits ? Number(limits.ledgerLimit) : null;
    }

    /**
     * Update limits
     */
    async update(userId: string, data: {
        escrowLimit?: number;
        ledgerLimit?: number;
    }) {
        return this.prisma.userLimit.update({
            where: { userId },
            data,
        });
    }
}
