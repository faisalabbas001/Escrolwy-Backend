import { Global, Module } from '@nestjs/common';
import { WalletConfigService } from './wallet.config';

/**
 * Configuration Module
 *
 * Provides wallet and chain configuration services globally.
 */
@Global()
@Module({
  providers: [WalletConfigService],
  exports: [WalletConfigService],
})
export class ConfigurationModule {}

