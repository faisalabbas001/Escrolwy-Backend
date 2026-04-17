/**
 * Journal Type Enum
 *
 * Defines all supported journal entry types in the Ledger service.
 * Journal types represent the business reason why money moved.
 *
 * Types use snake_case to match existing convention (internal_transfer, external_transfer).
 */
export enum JournalType {
  // Existing types
  INTERNAL_TRANSFER = 'internal_transfer',
  EXTERNAL_TRANSFER = 'external_transfer',

  // New types for escrow and wallet lifecycle
  DEPOSIT = 'deposit',
  ESCROW_PAY_RESERVED = 'escrow_pay_reserved',
  ESCROW_PAY_RELEASED = 'escrow_pay_released',
  ESCROW_PAY_RELEASED_BUYER = 'escrow_pay_released_buyer',
  ESCROW_PAY_SPLIT = 'escrow_pay_split',
  PLATFORM_FEE = 'platform_fee',
}

