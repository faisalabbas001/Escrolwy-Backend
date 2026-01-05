/**
 * Platform Fees Configuration
 *
 * Tiered fee structure based on transaction amount
 */

export interface FeeTier {
  minAmount: number;
  maxAmount: number | null; // null means infinity
  feePercentage: number;
  description: string;
}

export const PLATFORM_FEE_TIERS: FeeTier[] = [
  {
    minAmount: 1,
    maxAmount: 100,
    feePercentage: 4.5,
    description: '$1 - $100',
  },
  {
    minAmount: 100.01,
    maxAmount: 500,
    feePercentage: 3.5,
    description: '$100.01 - $500',
  },
  {
    minAmount: 500.01,
    maxAmount: 5000,
    feePercentage: 2.5,
    description: '$500.01 - $5,000',
  },
  {
    minAmount: 5000.01,
    maxAmount: 10000,
    feePercentage: 2.2,
    description: '$5,000.01 - $10,000',
  },
  {
    minAmount: 10000.01,
    maxAmount: 100000,
    feePercentage: 1.8,
    description: '$10,000.01 - $100,000',
  },
  {
    minAmount: 100000.01,
    maxAmount: 500000,
    feePercentage: 1.5,
    description: '$100,000.01 - $500,000',
  },
  {
    minAmount: 500000.01,
    maxAmount: 1000000,
    feePercentage: 1.0,
    description: '$500,000.01 - $1,000,000',
  },
  {
    minAmount: 1000000.01,
    maxAmount: 5000000,
    feePercentage: 0.7,
    description: '$1,000,000.01 - $5,000,000',
  },
  {
    minAmount: 5000000.01,
    maxAmount: 10000000,
    feePercentage: 0.4,
    description: '$5,000,000.01 - $10,000,000',
  },
  {
    minAmount: 10000000.01,
    maxAmount: null,
    feePercentage: 0.2,
    description: '$10,000,000+ (Contact Us)',
  },
];

/**
 * Calculate platform fee based on transaction amount
 *
 * @param amount - Transaction amount in USD/crypto equivalent
 * @returns Fee percentage and amount
 */
export function calculatePlatformFee(
  amount: number,
): { feePercentage: number; feeAmount: number; totalAmount: number } {
  const tier = PLATFORM_FEE_TIERS.find(
    (t) =>
      amount >= t.minAmount &&
      (t.maxAmount === null || amount <= t.maxAmount),
  );

  if (!tier) {
    throw new Error(`Amount ${amount} does not fall within any fee tier`);
  }

  const feeAmount = (amount * tier.feePercentage) / 100;
  const totalAmount = amount + feeAmount;

  return {
    feePercentage: tier.feePercentage,
    feeAmount: Math.round(feeAmount * 100) / 100, // Round to 2 decimals
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Get fee tier information for a given amount
 *
 * @param amount - Transaction amount
 * @returns Fee tier details
 */
export function getFeeTier(amount: number): FeeTier {
  const tier = PLATFORM_FEE_TIERS.find(
    (t) =>
      amount >= t.minAmount &&
      (t.maxAmount === null || amount <= t.maxAmount),
  );

  if (!tier) {
    throw new Error(`Amount ${amount} does not fall within any fee tier`);
  }

  return tier;
}

/**
 * Get all fee tiers (useful for displaying in UI)
 */
export function getAllFeeTiers(): FeeTier[] {
  return PLATFORM_FEE_TIERS;
}
