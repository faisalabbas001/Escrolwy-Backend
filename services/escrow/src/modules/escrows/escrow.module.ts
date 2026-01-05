import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../common/database/database.module';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import {
  EscrowRepository,
  EscrowTransitionRepository,
  EscrowReminderRepository,
  OutboxRepository,
} from './repository';
import { EscrowEventProducer } from '../../kafka';
import {
  KafkaRequestReplyService,
  RequestReplyConfig,
} from '@escrowly/kafka-core';
import { LedgerClientService } from './services';
import { EscrowReminderCronService } from './services/escrow-reminder-cron.service';
import { FeeValidatorService } from './validators';
import { LEDGER_CLIENT_TOKEN } from './services/interfaces/ledger-client.interface';
/**
 * Escrow Module
 *
 * Manages all escrow-related functionality
 * - Creation and management of escrow agreements
 * - State transitions and audit trails
 * - Payment processing
 * - Delivery and inspection workflow
 * - Dispute management
 */
@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [EscrowController],
  providers: [
    EscrowService,
    EscrowRepository,
    EscrowTransitionRepository,
    EscrowReminderRepository,
    OutboxRepository,
    EscrowEventProducer,
    EscrowReminderCronService,
    LedgerClientService,
    {
      provide: LEDGER_CLIENT_TOKEN,
      useExisting: LedgerClientService,
    },
    FeeValidatorService,
    {
      provide: KafkaRequestReplyService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const brokersStr = config.get<string>('KAFKA_BROKERS', 'localhost:9092');
        const brokers = brokersStr
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
          .map((b) => (b.includes(':') ? b : `${b}:9092`));

        const rrConfig: RequestReplyConfig = {
          clientId: 'escrow-service-rr',
          brokers,
          replyTopic: 'escrow-service.replies',
          timeoutMs: 30_000,
        };

        return new KafkaRequestReplyService(rrConfig);
      },
    },
  ],
  exports: [EscrowService],
})
export class EscrowModule {}
