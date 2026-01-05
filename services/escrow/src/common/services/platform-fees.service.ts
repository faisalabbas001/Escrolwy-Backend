import { Injectable } from '@nestjs/common';
import {
  calculatePlatformFee,
  getFeeTier,
  getAllFeeTiers,
  FeeTier,
} from '../config/platform-fees.config';

/**
 * Platform Fees Service
 *
 * Handles all fee calculations and tier management
 */
@Injectable()
export class PlatformFeesService {
  /**
   * Calculate fee for a transaction
   *
   * @param amount - Transaction amount
   * @returns Fee breakdown with percentage, amount, and total
   */
  calculateFee(
    amount: number,
  ): { feePercentage: number; feeAmount: number; totalAmount: number } {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    return calculatePlatformFee(amount);
  }

  /**
   * Get fee tier for a specific amount
   *
   * @param amount - Transaction amount
   * @returns Fee tier information
   */
  getFeeTierInfo(amount: number): FeeTier {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    return getFeeTier(amount);
  }

  /**
   * Get all available fee tiers
   *
   * @returns All fee tiers
   */
  getAllTiers(): FeeTier[] {
    return getAllFeeTiers();
  }

  /**
   * Estimate total cost including fees
   *
   * @param baseAmount - Base transaction amount
   * @returns Breakdown with fees and total
   */
  estimateTotalCost(baseAmount: number): {
    baseAmount: number;
    feePercentage: number;
    platformFee: number;
    totalCost: number;
    tier: FeeTier;
  } {
    if (baseAmount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const feeInfo = calculatePlatformFee(baseAmount);
    const tier = getFeeTier(baseAmount);

    return {
      baseAmount,
      feePercentage: feeInfo.feePercentage,
      platformFee: feeInfo.feeAmount,
      totalCost: feeInfo.totalAmount,
      tier,
    };
  }
}
