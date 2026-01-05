import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import {
  AccountRepository,
  TransferRepository,
  JournalRepository,
  EntryRepository,
  OutboxRepository,
} from './repository';
import {
  AccountResolverService,
  EntryBuilderService,
  TransferEventService,
  TransferExecutorService,
} from './services';
import { TransferValidator } from './validators';
import {
  TransferPostedEventProducer,
  BalanceUpdatedEventProducer,
  ExternalPayoutEventProducer,
  ExternalTransferEventProducer,
} from '../../kafka/producers';
import { OutboxEventService } from '../../kafka/producers/services';

/**
 * Transfer Module
 *
 * Handles all transfer-related operations
 * Follows SOLID principles with separated concerns
 */
@Module({
  controllers: [TransferController],
  providers: [
    // Main service
    TransferService,
    // Repositories (implement interfaces)
    AccountRepository,
    TransferRepository,
    JournalRepository,
    EntryRepository,
    OutboxRepository,
    // Validators (SRP)
    TransferValidator,
    // Services (SRP)
    AccountResolverService,
    EntryBuilderService,
    TransferEventService,
    TransferExecutorService,
    // Event producers (SRP)
    TransferPostedEventProducer,
    BalanceUpdatedEventProducer,
    ExternalPayoutEventProducer,
    ExternalTransferEventProducer,
    // Outbox event service (shared by producers)
    OutboxEventService,
  ],
  exports: [
    TransferService,
    TransferRepository,
    AccountRepository,
    JournalRepository,
    EntryRepository,
    EntryBuilderService,
    TransferValidator,
    BalanceUpdatedEventProducer, // Export for UserDepositHandler
  ], // Export repositories and services for other modules
})
export class TransferModule {}

