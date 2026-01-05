import { Injectable, Logger } from '@nestjs/common';
import { LimitsRepository } from './limits.repository';

/**
 * Limits Service
 *
 * Business logic for retrieving user limits.
 */
@Injectable()
export class LimitsService {
    private readonly logger = new Logger(LimitsService.name);

    constructor(private readonly limitsRepository: LimitsRepository) { }

    /**
     * Get all limits for a user
     */
    async getLimits(userId: string) {
        const limits = await this.limitsRepository.findByUserId(userId);

        if (!limits) {
            return {
                userId,
                escrowLimit: 0,
                ledgerLimit: 0,
                hasLimits: false,
            };
        }

        return {
            userId,
            escrowLimit: Number(limits.escrowLimit),
            ledgerLimit: Number(limits.ledgerLimit),
            hasLimits: true,
            updatedAt: limits.updatedAt.toISOString(),
        };
    }
}
