import { Module } from '@nestjs/common';
import { KmsService } from './kms.service';
import { EncryptionService } from './encryption.service';
import { PlatformKeyService } from './platform-key.service';
import { WalletGeneratorService } from './wallet-generator.service';
import { EvmExecutorService } from './evm-executor.service';
import { SolanaExecutorService } from './solana-executor.service';
import { TronExecutorService } from './tron-executor.service';

/**
 * Crypto Module
 *
 * Provides wallet generation, encryption, and transaction execution services.
 * Supports both local and KMS-based encryption modes.
 */
@Module({
  providers: [
    KmsService,
    EncryptionService,
    PlatformKeyService,
    WalletGeneratorService,
    EvmExecutorService,
    SolanaExecutorService,
    TronExecutorService,
  ],
  exports: [
    KmsService,
    EncryptionService,
    PlatformKeyService,
    WalletGeneratorService,
    EvmExecutorService,
    SolanaExecutorService,
    TronExecutorService,
  ],
})
export class CryptoModule {}
