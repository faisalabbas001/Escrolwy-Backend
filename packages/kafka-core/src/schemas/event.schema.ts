/**
 * Event Schemas
 *
 * Type definitions for all Kafka event payloads.
 * Shared between producers and consumers.
 */

// ==========================================
// BASE EVENT TYPES
// ==========================================

export interface EventMetadata {
  eventId: string;
  timestamp: string;
  eventType: string;
  source: string;
  version: string;
  correlationId?: string;
  causationId?: string;
}

export interface BaseEvent<T = unknown> {
  metadata: EventMetadata;
  payload: T;
}

export type LedgerAction =
  | 'reserve_funds'
  | 'release_to_seller'
  | 'refund_to_buyer'
  | 'freeze_funds'
  | 'unfreeze_funds';

// ==========================================
// ESCROW EVENT PAYLOADS
// ==========================================

export interface EscrowSnapshot {
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
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
}

export interface EscrowCreatedPayload {
  escrow: EscrowSnapshot;
  initiatedBy: string;
}

export interface EscrowAcceptedPayload {
  escrowId: string;
  acceptedBy: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  asset: string;
}

export interface PaymentCompletedPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  asset: string;
  chain: string;
  transactionHash?: string;
  ledgerAction: 'reserve_funds';
  buyerFee?: number;
  sellerFee?: number;
  buyerAmount?: number;
}

export interface DeliveryStartedPayload {
  escrowId: string;
  sellerId: string;
  buyerId: string;
  deliveryProof: string;
  notes?: string;
  inspectionDeadline?: string;
}

export interface InspectionStartedPayload {
  escrowId: string;
  sellerId: string;
  buyerId: string;
  inspectionDeadline: string;
}

export interface InspectionCompletedPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  status: 'accepted' | 'rejected';
  inspectionNotes: string;
  ledgerAction?: 'release_to_seller';
}

export interface EscrowCompletedPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  asset: string;
  chain: string;
  platformFee: number;
  buyerFee: number; // Buyer's portion of the fee (reserved)
  sellerFee: number; // Seller's portion of the fee (reserved)
  completedAt: string;
  ledgerAction: 'release_to_seller';
}

export interface EscrowRefundedPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  asset: string;
  chain: string;
  reason: string;
  refundedBy: string;
  ledgerAction: 'refund_to_buyer';
}

export interface EscrowCancelledPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  cancelledBy: string;
  reason: string;
  previousState: string;
  ledgerAction?: 'refund_to_buyer';
}

export interface DisputeOpenedPayload {
  escrowId: string;
  disputedBy: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  asset: string;
  reason: string;
  evidence?: string;
  previousState: string;
  ledgerAction: 'freeze_funds';
}

export interface DisputeResolvedPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  asset: string;
  chain: string;
  resolution: 'buyer_wins' | 'seller_wins' | 'refund';
  resolvedBy: string;
  adminNotes: string;
  ledgerAction: 'release_to_seller' | 'refund_to_buyer';
}

export interface ForceClosedPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  closedBy: string;
  reason: string;
  previousState: string;
  fundsAction: 'refund_buyer' | 'release_seller' | 'no_action';
  ledgerAction?: 'release_to_seller' | 'refund_to_buyer';
}

export interface EscrowReminderPayload {
  escrowId: string;
  buyerId: string;
  sellerId: string;
  brokerId?: string;
  currentState: string;
  elapsedHours: number;
  reminderType: string;
  notifiedUserIds: string[];
}

// ==========================================
// AUTH EVENT PAYLOADS
// ==========================================

export interface UserCreatedPayload {
  userId: string;
  email: string;
  role: string;
  displayName?: string;
  createdAt: string;
}

export interface UserUpdatedPayload {
  userId: string;
  email: string;
  changes: { field: string; oldValue?: string; newValue?: string }[];
  updatedBy: string;
  updatedAt: string;
}

export interface UserLockedPayload {
  userId: string;
  byAdmin: string;
  reason: string | null;
  at: string;
}

export interface UserUnlockedPayload {
  userId: string;
  byAdmin: string;
  reason: string | null;
  at: string;
}

export interface UserRoleChangedPayload {
  userId: string;
  oldRole: string;
  newRole: string;
  byAdmin: string;
  at: string;
}

export interface UserKycStateChangedPayload {
  userId: string;
  oldState: string;
  newState: string;
  provider: string;
  at: string;
}

export interface SessionCreatedPayload {
  sessionId: string;
  userId: string;
  email: string;
  device?: { name?: string; ip?: string; userAgent?: string };
  createdAt: string;
  expiresAt: string;
}

export interface SessionRevokedPayload {
  sessionId: string;
  userId: string;
  reason: string;
  revokedAt: string;
}

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  resetToken: string;
  expiresAt: string;
  requestedAt: string;
}

export interface PasswordChangedPayload {
  userId: string;
  email: string;
  changedAt: string;
  reason: 'reset' | 'user_change';
}

// ==========================================
// WALLET EVENT PAYLOADS (consumed by Auth)
// ==========================================

export interface WalletInfo {
  chain: string;
  address: string;
}

export interface WalletsCreatedPayload {
  userId: string;
  wallets: WalletInfo[];
  at: string;
}

// ==========================================
// COMPLIANCE EVENT PAYLOADS (consumed by Auth)
// ==========================================

export interface KycUpdatedPayload {
  userId: string;
  state: 'PENDING' | 'VERIFIED' | 'REJECTED';
  providerRef: string;
  at: string;
}

/**
 * Compliance Failure Payload
 *
 * Emitted when a failure occurs in the compliance service.
 * Used for monitoring, alerting, and reporting purposes.
 */
export interface ComplianceFailurePayload {
  /** User ID if applicable */
  userId?: string;
  /** Type of entity that failed */
  entityType: 'kyc' | 'limits' | 'persona' | 'general';
  /** Entity ID if applicable */
  entityId?: string;
  /** Category of failure */
  failureType: 'validation' | 'external_service' | 'processing' | 'timeout';
  /** Machine-readable failure code */
  failureCode: string;
  /** Human-readable failure reason */
  failureReason: string;
  /** Operation that was being performed */
  sourceOperation: string;
  /** Severity level for alerting */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** ISO timestamp when failure occurred */
  occurredAt: string;
}

// ==========================================
// LEDGER EVENT PAYLOADS
// ==========================================

export interface BalanceReservedPayload {
  walletId: string;
  userId: string;
  amount: number;
  asset: string;
  escrowId: string;
  reservedAt: string;
}

export interface BalanceReleasedPayload {
  walletId: string;
  userId: string;
  amount: number;
  asset: string;
  escrowId: string;
  releasedTo: 'buyer' | 'seller';
  releasedAt: string;
}

export interface TransactionConfirmedPayload {
  transactionId: string;
  type: string;
  amount: number;
  asset: string;
  transactionHash: string;
  confirmations: number;
  confirmedAt: string;
}

export interface TransactionFailedPayload {
  transactionId: string;
  type: string;
  amount: number;
  asset: string;
  transactionHash?: string;
  reason: string;
  failedAt: string;
}

export interface TransferPostedPayload {
  transferId: string;
  type: 'internal' | 'external' | 'escrow_released';
  asset: string;
  amount: number;
  chain: string;
  senderId: string;
  destinationUserId?: string;
  destinationAddress?: string;
  destinationChain: string;
  journalId: string;
  postedAt: string;
}

export interface BalanceUpdatedPayload {
  accountId: string;
  ownerType: string;
  ownerId?: string;
  asset: string;
  chain: string;
  purpose: string;
  balance: number;
  updatedAt: string;
}

export interface ExternalPayoutCreatedPayload {
  transferId: string;
  asset: string;
  amount: number;
  chain: string;
  senderId: string;
  destinationAddress: string;
  destinationChain: string;
  createdAt: string;
}

export interface ExternalTransferCreatedPayload {
  transferId: string;
  userId: string;
  asset: string;
  amount: number;
  chain: string;
  destinationAddress: string;
  destinationChain: string;
  idempotencyKey: string;
  createdAt: string;
}

// ==========================================
// EVENT TYPE MAPS
// ==========================================

export type EscrowEventPayloads = {
  'escrow.created': EscrowCreatedPayload;
  'escrow.accepted': EscrowAcceptedPayload;
  'escrow.payment.completed': PaymentCompletedPayload;
  'escrow.delivery.started': DeliveryStartedPayload;
  'escrow.inspection.completed': InspectionCompletedPayload;
  'escrow.completed': EscrowCompletedPayload;
  'escrow.refunded': EscrowRefundedPayload;
  'escrow.cancelled': EscrowCancelledPayload;
  'escrow.disputed': DisputeOpenedPayload;
  'escrow.resolved': DisputeResolvedPayload;
  'escrow.force.closed': ForceClosedPayload;
  'escrow.reminder.accept': EscrowReminderPayload;
  'escrow.reminder.fund': EscrowReminderPayload;
  'escrow.reminder.deliver': EscrowReminderPayload;
  'escrow.reminder.inspect': EscrowReminderPayload;
  'escrow.reminder.complete': EscrowReminderPayload;
  'escrow.reminder.dispute': EscrowReminderPayload;
};

export type AuthEventPayloads = {
  'auth.user.created': UserCreatedPayload;
  'auth.user.updated': UserUpdatedPayload;
  'auth.user.locked': UserLockedPayload;
  'auth.user.unlocked': UserUnlockedPayload;
  'auth.user.role_changed': UserRoleChangedPayload;
  'auth.user.kyc_state_changed': UserKycStateChangedPayload;
  'auth.session.created': SessionCreatedPayload;
  'auth.session.revoked': SessionRevokedPayload;
  'auth.password.reset.requested': PasswordResetRequestedPayload;
  'auth.password.changed': PasswordChangedPayload;
};


export type ComplianceEventPayloads = {
  'compliance.kyc.updated': KycUpdatedPayload;
  'compliance.failure': ComplianceFailurePayload;
};

export type LedgerEventPayloads = {
  'ledger.balance.reserved': BalanceReservedPayload;
  'ledger.balance.released': BalanceReleasedPayload;
  'ledger.transaction.confirmed': TransactionConfirmedPayload;
  'ledger.transaction.failed': TransactionFailedPayload;
  'ledger.transfer_posted': TransferPostedPayload;
  'ledger.balance_updated': BalanceUpdatedPayload;
  'ledger.external_payout_created': ExternalPayoutCreatedPayload;
  'ledger.external_transfer_created': ExternalTransferCreatedPayload;
};

// ==========================================
// INQUIRY EVENT PAYLOADS
// ==========================================

export interface InquirySnapshot {
  id: string;
  escrowId: string;
  createdBy: string;
  assignedAdminId?: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface InquiryCreatedPayload {
  inquiry: InquirySnapshot;
  initialMessage?: string;
  createdBy: string;
}

export interface InquiryClosedPayload {
  inquiryId: string;
  escrowId: string;
  status: 'closed';
  closedBy: string;
  note?: string;
  closedAt: string;
}

export interface InquiryResolvedPayload {
  inquiryId: string;
  escrowId: string;
  status: 'closed';
  resolvedBy: string;
  resolutionType: string; // "Refund to Buyer", "Release to Seller", or "Split Funds"
  resolutionNote?: string;
  resolvedAt: string;
  buyerId: string; // User ID of the buyer (for notifications)
  sellerId: string; // User ID of the seller (for notifications)
}

export interface InquiryAssignedPayload {
  inquiryId: string;
  escrowId: string;
  adminId: string;
  assignedBy: string;
  assignedAt: string;
}

export interface InquiryMessageAddedPayload {
  messageId: string;
  inquiryId: string;
  escrowId: string;
  senderId: string;
  senderRole: 'buyer' | 'seller' | 'admin';
  message?: string;
  createdAt: string;
  /**
   * Array of user IDs who should receive notifications for this message (excluding the sender).
   * Includes buyer, seller, and assigned admin (if any).
   * Notification service uses this to send emails to offline participants.
   */
  recipientIds: string[];
}

export interface InquiryAttachmentUploadedPayload {
  attachmentId: string;
  inquiryId: string;
  escrowId: string;
  messageId: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string;
}

export type InquiryEventPayloads = {
  'inquiry.created': InquiryCreatedPayload;
  'inquiry.closed': InquiryClosedPayload;
  'inquiry.resolved': InquiryResolvedPayload;
  'inquiry.assigned': InquiryAssignedPayload;
  'inquiry.message.added': InquiryMessageAddedPayload;
  'inquiry.attachment.uploaded': InquiryAttachmentUploadedPayload;
};

// ==========================================
// NOTIFICATION EVENT PAYLOADS
// ==========================================

export interface NotificationSentPayload {
  notificationId: string;
  userId: string;
  eventType: string;
  eventKey: string;
  templateId: string;
  recipientEmail: string;
  subject: string;
  resendId: string;
  sentAt: string;
}

export interface NotificationDeliveryFailedPayload {
  notificationId: string;
  userId: string;
  eventType: string;
  eventKey: string;
  templateId: string;
  recipientEmail: string;
  subject: string;
  errorMessage: string;
  failedAt: string;
  retryCount: number;
}

export type NotificationEventPayloads = {
  'notification.email.sent': NotificationSentPayload;
  'notification.email.failed': NotificationDeliveryFailedPayload;
};

// ==========================================
// WALLET EVENT PAYLOADS
// ==========================================

export interface WalletCreatedPayload {
  userId: string;
  wallets: Array<{
    chain: string;
    depositAddress: string;
  }>;
  createdAt: string;
}

export interface DepositDetectedPayload {
  userId: string;
  depositId: string;
  chain: string;
  asset: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  depositAddress: string;
  detectedAt: string;
}

export interface DepositConfirmedPayload {
  userId: string;
  depositId: string;
  chain: string;
  asset: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  depositAddress: string;
  confirmedAt: string;
}

export interface WithdrawalCompletedPayload {
  payoutRequestId: string;
  userId: string;
  chain: string;
  asset: string;
  amount: string;
  destinationAddress: string;
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  completedAt: string;
}

export interface WithdrawalFailedPayload {
  payoutRequestId: string;
  userId: string;
  chain: string;
  asset: string;
  amount: string;
  destinationAddress: string;
  errorMessage: string;
  attemptNumber: number;
  failedAt: string;
}

export interface SweepCompletedPayload {
  walletId: string;
  userId: string;
  chain: string;
  asset: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  completedAt: string;
}

export interface PayoutPermanentlyFailedPayload {
  payoutRequestId: string;
  userId: string;
  chain: string;
  asset: string;
  amount: string;
  destinationAddress: string;
  totalAttempts: number;
  lastErrorMessage: string;
  failedAt: string;
}

export interface SweepFailedPayload {
  walletId: string;
  depositId: string;
  userId: string;
  chain: string;
  asset: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  errorMessage: string;
  failedAt: string;
}

export interface HotToColdCompletedPayload {
  chain: string;
  asset: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  completedAt: string;
}

export interface HotToColdFailedPayload {
  chain: string;
  asset: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  errorMessage: string;
  failedAt: string;
}

export type WalletEventPayloads = {
  'wallet.user.wallets_created': WalletsCreatedPayload;
  'wallet.deposit.detected': DepositDetectedPayload;
  'wallet.deposit.confirmed': DepositConfirmedPayload;
  'wallet.withdrawal.completed': WithdrawalCompletedPayload;
  'wallet.withdrawal.failed': WithdrawalFailedPayload;
  'wallet.wallet.created': WalletCreatedPayload;
  'wallet.sweep.completed': SweepCompletedPayload;
  'wallet.payout.permanently_failed': PayoutPermanentlyFailedPayload;
  'wallet.sweep.failed': SweepFailedPayload;
  'wallet.hot_to_cold.completed': HotToColdCompletedPayload;
  'wallet.hot_to_cold.failed': HotToColdFailedPayload;
};

