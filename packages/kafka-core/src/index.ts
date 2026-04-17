/**
 * @escrowly/kafka-core
 *
 * Centralized Kafka infrastructure for Escrowly microservices.
 *
 * @example
 * ```typescript
 * import {
 *   // Module
 *   KafkaModule,
 *   KafkaService,
 *
 *   // Topics
 *   EscrowTopics,
 *   AuthTopics,
 *   LedgerTopics,
 *
 *   // Event schemas
 *   EscrowCreatedPayload,
 *   PaymentCompletedPayload,
 *   BaseEvent,
 *
 *   // Validation
 *   SchemaValidator,
 * } from '@escrowly/kafka-core';
 *
 * // Usage in service
 * await kafkaService.produce(
 *   EscrowTopics.CREATED,
 *   payload,
 *   escrowId,
 * );
 * ```
 */

// ==========================================
// MODULE
// ==========================================
export { KafkaModule, KafkaModuleOptions, KafkaModuleAsyncOptions } from './module';

// ==========================================
// SERVICES
// ==========================================
export {
  KafkaService,
  KafkaServiceConfig,
  KafkaProducer,
  ProducerConfig,
  KafkaConsumer,
  ConsumerConfig,
  EventHandler,
  KafkaRequestReplyService,
  RequestReplyConfig,
  KafkaConsumerWrapperService,
  ConsumerWrapperConfig,
  WrappedEventHandler,
} from './services';

// ==========================================
// CONSTANTS (Topics)
// ==========================================
export {
  EscrowTopics,
  AuthTopics,
  WalletTopics,
  ComplianceTopics,
  LedgerTopics,
  NotificationTopics,
  AdminTopics,
  InquiryTopics,
  AllTopics,
} from './constants';

// ==========================================
// SCHEMAS (Event Payloads)
// ==========================================
export {
  // Base types
  EventMetadata,
  BaseEvent,
  LedgerAction,
  // Escrow payloads
  EscrowSnapshot,
  EscrowCreatedPayload,
  EscrowAcceptedPayload,
  PaymentCompletedPayload,
  DeliveryStartedPayload,
  InspectionCompletedPayload,
  InspectionStartedPayload,
  EscrowCompletedPayload,
  EscrowRefundedPayload,
  EscrowCancelledPayload,
  DisputeOpenedPayload,
  DisputeResolvedPayload,
  ForceClosedPayload,
  EscrowEventPayloads,
  EscrowReminderPayload,
  // Auth payloads
  UserCreatedPayload,
  UserUpdatedPayload,
  UserLockedPayload,
  UserUnlockedPayload,
  UserRoleChangedPayload,
  UserKycStateChangedPayload,
  SessionCreatedPayload,
  SessionRevokedPayload,
  PasswordResetRequestedPayload,
  PasswordChangedPayload,
  AuthEventPayloads,
  // Wallet payloads (consumed by Auth)
  WalletInfo,
  WalletsCreatedPayload,
  // Compliance payloads (consumed by Auth)
  KycUpdatedPayload,
  ComplianceFailurePayload,
  ComplianceEventPayloads,
  // Ledger payloads
  BalanceReservedPayload,
  BalanceReleasedPayload,
  TransactionConfirmedPayload,
  TransactionFailedPayload,
  TransferPostedPayload,
  BalanceUpdatedPayload,
  ExternalPayoutCreatedPayload,
  ExternalTransferCreatedPayload,
  LedgerEventPayloads,
  // Inquiry payloads
  InquirySnapshot,
  InquiryCreatedPayload,
  InquiryClosedPayload,
  InquiryResolvedPayload,
  InquiryAssignedPayload,
  InquiryMessageAddedPayload,
  InquiryAttachmentUploadedPayload,
  InquiryEventPayloads,
  // Notification payloads
  NotificationSentPayload,
  NotificationDeliveryFailedPayload,
  NotificationEventPayloads,
  // Wallet payloads
  WalletCreatedPayload,
  DepositDetectedPayload,
  DepositConfirmedPayload,
  WithdrawalCompletedPayload,
  WithdrawalFailedPayload,
  SweepCompletedPayload,
  PayoutPermanentlyFailedPayload,
  SweepFailedPayload,
  HotToColdCompletedPayload,
  HotToColdFailedPayload,
  WalletEventPayloads,
  // Validation
  SchemaValidator,
} from './schemas';
