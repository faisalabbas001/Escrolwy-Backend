/**
 * Kafka Topics Enum
 *
 * Centralized topic definitions for all Escrowly services.
 * Use these constants to ensure consistency across producers and consumers.
 */

// ==========================================
// ESCROW TOPICS
// ==========================================
export enum EscrowTopics {
  CREATED = 'escrow.created',
  ACCEPTED = 'escrow.accepted',
  PAYMENT_COMPLETED = 'escrow.payment.completed',
  DELIVERY_STARTED = 'escrow.delivery.started',
  INSPECTION_STARTED = 'escrow.inspection.started',
  INSPECTION_COMPLETED = 'escrow.inspection.completed',
  COMPLETED = 'escrow.completed',
  REFUNDED = 'escrow.refunded',
  CANCELLED = 'escrow.cancelled',
  DISPUTED = 'escrow.disputed',
  RESOLVED = 'escrow.resolved',
  FORCE_CLOSED = 'escrow.force.closed',
  REMINDER_SENT = 'escrow.reminder.sent',
  REMINDER_ACCEPT = 'escrow.reminder.accept',
  REMINDER_FUND = 'escrow.reminder.fund',
  REMINDER_DELIVER = 'escrow.reminder.deliver',
  REMINDER_INSPECT = 'escrow.reminder.inspect',
  REMINDER_COMPLETE = 'escrow.reminder.complete',
  REMINDER_DISPUTE = 'escrow.reminder.dispute',
  SLA_BREACH = 'escrow.sla.breach',
}

// ==========================================
// AUTH TOPICS
// ==========================================
export enum AuthTopics {
  USER_CREATED = "auth.user.created",
  USER_UPDATED = "auth.user.updated",
  USER_DELETED = "auth.user.deleted",
  USER_LOCKED = "auth.user.locked",
  USER_UNLOCKED = "auth.user.unlocked",
  USER_ROLE_CHANGED = 'auth.user.role_changed',
  USER_KYC_STATE_CHANGED = 'auth.user.kyc_state_changed',
  SESSION_CREATED = "auth.session.created",
  SESSION_REVOKED = "auth.session.revoked",
  KYC_SUBMITTED = "auth.kyc.submitted",
  KYC_APPROVED = "auth.kyc.approved",
  KYC_REJECTED = "auth.kyc.rejected",
  PASSWORD_CHANGED = "auth.password.changed",
  PASSWORD_RESET_REQUESTED = "auth.password.reset.requested",
  MFA_ENABLED = "auth.mfa.enabled",
  MFA_DISABLED = "auth.mfa.disabled",
}

// ==========================================
// WALLET TOPICS (consumed by Auth)
// ==========================================
export enum WalletTopics {
  EVENTS = 'wallet.events',
  WALLETS_CREATED = 'wallet.user.wallets_created',
}

// ==========================================
// COMPLIANCE TOPICS (consumed by Auth)
// ==========================================
export enum ComplianceTopics {
  EVENTS = 'compliance.events',
  KYC_UPDATED = 'compliance.kyc.updated',
  KYC_STARTED = 'compliance.kyc.started',
  KYC_APPROVED = 'compliance.kyc.approved',
  KYC_REJECTED = 'compliance.kyc.rejected',
  KYC_REVIEW_REQUIRED = 'compliance.kyc.review_required',
  LIMITS_UPDATED = 'compliance.limits.updated',
  FAILURE = 'compliance.failure',
}

// ==========================================
// LEDGER TOPICS
// ==========================================
export enum LedgerTopics {
  WALLET_CREATED = 'ledger.wallet.created',
  WALLET_FUNDED = 'ledger.wallet.funded',
  WALLET_WITHDRAWN = 'ledger.wallet.withdrawn',
  TRANSACTION_CREATED = 'ledger.transaction.created',
  TRANSACTION_CONFIRMED = 'ledger.transaction.confirmed',
  TRANSACTION_FAILED = 'ledger.transaction.failed',
  BALANCE_RESERVED = 'ledger.balance.reserved',
  BALANCE_RELEASED = 'ledger.balance.released',
  BALANCE_FROZEN = 'ledger.balance.frozen',
  BALANCE_UNFROZEN = 'ledger.balance.unfrozen',
  TRANSFER_POSTED = 'ledger.transfer_posted',
  BALANCE_UPDATED = 'ledger.balance_updated',
  EXTERNAL_PAYOUT_CREATED = 'ledger.external_payout_created',
  EXTERNAL_TRANSFER_CREATED = 'ledger.external_transfer_created',
}

// ==========================================
// NOTIFICATION TOPICS
// ==========================================
export enum NotificationTopics {
  EMAIL_SENT = "notification.email.sent",
  EMAIL_FAILED = "notification.email.failed",
  PUSH_SENT = "notification.push.sent",
  PUSH_FAILED = "notification.push.failed",
  SMS_SENT = "notification.sms.sent",
  SMS_FAILED = "notification.sms.failed",
}

// ==========================================
// ADMIN TOPICS
// ==========================================
export enum AdminTopics {
  ADMIN_ACTION = "admin.action",
  AUDIT_LOG = "admin.audit.log",
  CONFIG_CHANGED = "admin.config.changed",
}

// ==========================================
// INQUIRY TOPICS
// ==========================================
export enum InquiryTopics {
  // Inquiry lifecycle events
  INQUIRY_CREATED = "inquiry.created",
  INQUIRY_CLOSED = "inquiry.closed",
  INQUIRY_RESOLVED = "inquiry.resolved",
  INQUIRY_ASSIGNED = "inquiry.assigned",

  // Message events
  MESSAGE_ADDED = "inquiry.message.added",

  // Attachment events
  ATTACHMENT_UPLOADED = "inquiry.attachment.uploaded",
}




// ==========================================
// WALLET TOPICS
// ==========================================
export enum WalletTopics {
  DEPOSIT_DETECTED = 'wallet.deposit.detected',
  DEPOSIT_CONFIRMED = 'wallet.deposit.confirmed',
  WITHDRAWAL_COMPLETED = 'wallet.withdrawal.completed',
  WITHDRAWAL_FAILED = 'wallet.withdrawal.failed',
  WALLET_CREATED = 'wallet.wallet.created',
  SWEEP_COMPLETED = 'wallet.sweep.completed',
  PAYOUT_PERMANENTLY_FAILED = 'wallet.payout.permanently_failed',
  SWEEP_FAILED = 'wallet.sweep.failed',
  HOT_TO_COLD_COMPLETED = 'wallet.hot_to_cold.completed',
  HOT_TO_COLD_FAILED = 'wallet.hot_to_cold.failed',
}



// ==========================================
// ALL TOPICS TYPE
// ==========================================
export type AllTopics =
  | EscrowTopics
  | WalletTopics
  | ComplianceTopics
  | LedgerTopics
  | NotificationTopics
  | AdminTopics
  | WalletTopics
  | InquiryTopics;
