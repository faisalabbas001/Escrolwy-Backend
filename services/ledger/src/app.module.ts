import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthCommonModule } from '@escrowly/auth-common';
import { KafkaModule } from '@escrowly/kafka-core';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { TransferModule } from './modules/transfers/transfer.module';
import { AccountModule } from './modules/accounts/account.module';
import { ReservationModule } from './modules/reservations/reservation.module';
import { InternalTransferModule } from './modules/internal-transfers/internal-transfer.module';
import { ExternalTransferModule } from './modules/external-transfers/external-transfer.module';
import {
  LedgerConsumer,
  TransactionConfirmedHandler,
  TransactionFailedHandler,
  PaymentCompletedHandler,
  EscrowCompletedHandler,
  UserDepositHandler,
  EscrowRefundedHandler,
  EscrowCancelledHandler,
  DisputeResolvedHandler,
  EventValidatorService,
  TransferIdExtractorService,
} from './kafka/consumers';
import { LedgerOutboxAdapter } from './kafka/adapters';

/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - AuthCommonModule: Guards and decorators
 * - KafkaModule: Centralized Kafka infrastructure
 * - DatabaseModule: Prisma ORM configuration
 * - HealthModule: Health check endpoints
 * - TransferModule: Transfer service endpoints
 * - AccountModule: Account and balance endpoints
 */
@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // Auth common module (guards, decorators)
    AuthCommonModule,

    // Kafka module (centralized)
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const brokersStr = config.get<string>('KAFKA_BROKERS', 'localhost:9092');
        const brokersArray = brokersStr
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
          .map((b) => (b.includes(':') ? b : `${b}:9092`));

        console.log('[KafkaConfig] brokers =', brokersArray);
        const enabled = config.get('KAFKA_ENABLED', 'false') === 'true';
        console.log('[KafkaConfig] enabled =', enabled);

        return {
          clientId: 'ledger-service',
          groupId: 'ledger-consumer-group',
          brokers: brokersArray.join(','),
          enabled,
        };
      },
      inject: [ConfigService],
    }),

    // Database connectivity
    DatabaseModule,

    // Kafka Publisher Module (reliable event publishing)
    KafkaPublisherModule.forRoot({
      adapter: LedgerOutboxAdapter,
      config: {
        pollingIntervalMs: 2000,
        batchSize: 20,
        maxRetries: 5,
        baseBackoffMs: 5000,
        maxBackoffMs: 60000,
      },
    }),

    // Health check module
    HealthModule,

    // Transfer module (exports TransferRepository for LedgerConsumer)
    TransferModule,

    // Account module
    AccountModule,

    // Reservation module
    ReservationModule,

    // Internal Transfer module
    InternalTransferModule,

    // External Transfer module
    ExternalTransferModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Kafka consumer and handlers
    LedgerConsumer,
    TransactionConfirmedHandler,
    TransactionFailedHandler,
    PaymentCompletedHandler,
    EscrowCompletedHandler,
    UserDepositHandler,
    EscrowRefundedHandler,
    EscrowCancelledHandler,
    DisputeResolvedHandler,
    EventValidatorService,
    TransferIdExtractorService,
  ],
})
export class AppModule {}

