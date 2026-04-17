import { Module } from '@nestjs/common';
import { WithdrawalRetryCron } from './withdrawal-retry.cron';
import { DepositSweepCron } from './deposit-sweep.cron';
import { HotToColdService } from './hot-to-cold.service';
import { CryptoModule } from '../crypto';
import { KafkaIntegrationModule } from '../kafka';

/**
 * Cron Module
 *
 * Contains scheduled jobs:
 * - WithdrawalRetryCron: Retries failed withdrawals
 * - DepositSweepCron: Sweeps deposits to hot wallet
 *
 * Services:
 * - HotToColdService: Transfers excess funds from hot to cold wallet
 */
@Module({
  imports: [CryptoModule, KafkaIntegrationModule],
  providers: [WithdrawalRetryCron, DepositSweepCron, HotToColdService],
  exports: [WithdrawalRetryCron, DepositSweepCron, HotToColdService],
})
export class CronModule {}

