import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { CryptoModule } from '../crypto';

/**
 * Wallets Module
 *
 * Read-only API for querying user wallets (public data only).
 * Provides balance queries for platform wallets.
 */
@Module({
  imports: [CryptoModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
