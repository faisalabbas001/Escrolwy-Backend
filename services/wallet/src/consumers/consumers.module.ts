import { Module } from '@nestjs/common';
import { UserCreatedConsumer } from './user-created.consumer';
import { WithdrawalRequestedConsumer } from './withdrawal-requested.consumer';
import { DepositProcessorService } from './deposit-processor.service';
import { CryptoModule } from '../crypto';
import { KafkaIntegrationModule } from '../kafka';

/**
 * Consumers Module
 *
 * Contains all event consumers:
 * - UserCreatedConsumer: Kafka consumer for auth.user.created
 * - WithdrawalRequestedConsumer: Kafka consumer for ledger.external_payout_created
 * - DepositProcessorService: Redis consumer for raw blockchain events
 */
@Module({
  imports: [CryptoModule, KafkaIntegrationModule],
  providers: [
    UserCreatedConsumer,
    WithdrawalRequestedConsumer,
    DepositProcessorService,
  ],
  exports: [DepositProcessorService],
})
export class ConsumersModule {}
