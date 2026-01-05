/**
 * Escrow Entity
 *
 * Represents a single escrow transaction with current state
 */
export class EscrowEntity {
  id: string;
  buyerId: string;
  sellerId: string;
  brokerId?: string;
  amount: number;
  asset: string;
  chain: string;
  platformFee: number;
  state: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  completedAt?: Date;
  disputedAt?: Date;
  createdBy: string;
  disputedBy?: string;
  // Payment tracking fields
  buyerPaid?: boolean;
  sellerPaid?: boolean;
  buyerPaidAmount?: number;
  sellerPaidAmount?: number;
}

/**
 * Escrow Transition Entity
 *
 * Immutable audit log entry for state changes
 */
export class EscrowTransitionEntity {
  id: string;
  escrowId: string;
  previousState: string;
  newState: string;
  changedBy: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Escrow Fees Entity
 *
 * Platform fee tracking per escrow
 */
export class EscrowFeesEntity {
  id: string;
  escrowId: string;
  feeAmount: number;
  feePercentage?: number;
  paidBy: string;
  createdAt: Date;
}

/**
 * Escrow Reminder Entity
 *
 * SLA and automation reminder
 */
export class EscrowReminderEntity {
  id: string;
  escrowId: string;
  type: string;
  scheduledAt: Date;
  sentAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Escrow Outbox Entity
 *
 * Event sourcing outbox for reliable event publishing
 */
export class EscrowOutboxEntity {
  id: string;
  escrowId?: string;
  eventType: string;
  eventKey: string;
  payload: Record<string, any>;
  status: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}
