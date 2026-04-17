import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { WalletConfigService, type WalletChainId } from '../config';
import { EncryptionService } from './encryption.service';
import { PrismaService } from '../prisma';

type WalletType = 'hot' | 'funding' | 'cold';

/**
 * Platform Key Service
 *
 * Manages platform wallet private keys and addresses (hot, funding, cold).
 * Keys are stored KMS-encrypted in the database and decrypted on-demand.
 *
 * Security: NO CACHING - keys are decrypted fresh on every use.
 * Plaintext keys are never stored in memory longer than necessary.
 */
@Injectable()
export class PlatformKeyService implements OnModuleInit {
  private readonly logger = new Logger(PlatformKeyService.name);

  constructor(
    private readonly walletConfig: WalletConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const mode = this.walletConfig.getEncryptionMode();
    this.logger.log(`Platform key service initialized (mode: ${mode}, DB storage, no caching)`);

    // Verify platform keys exist in database
    const count = await this.prisma.platformKey.count();
    if (count === 0) {
      this.logger.warn('No platform keys found in database! Run: npx ts-node scripts/seed-platform-keys-to-db.ts');
    } else {
      this.logger.log(`Found ${count} platform keys in database`);
    }
  }

  /**
   * Get hot wallet key for a chain
   * Fetches from DB, decrypts via KMS - no caching
   */
  async getHotWalletKey(chainId: WalletChainId): Promise<string> {
    return this.getPrivateKey(chainId, 'hot');
  }

  /**
   * Get funding wallet key for a chain
   * Fetches from DB, decrypts via KMS - no caching
   */
  async getFundingWalletKey(chainId: WalletChainId): Promise<string> {
    return this.getPrivateKey(chainId, 'funding');
  }

  /**
   * Get hot wallet address for a chain
   */
  async getHotWalletAddress(chainId: WalletChainId): Promise<string> {
    return this.getAddress(chainId, 'hot');
  }

  /**
   * Get cold wallet address for a chain
   */
  async getColdWalletAddress(chainId: WalletChainId): Promise<string> {
    return this.getAddress(chainId, 'cold');
  }

  /**
   * Get funding wallet address for a chain (same as hot wallet)
   */
  async getFundingWalletAddress(chainId: WalletChainId): Promise<string> {
    return this.getAddress(chainId, 'funding');
  }

  /**
   * Get hot wallet ENCRYPTED key for a chain
   * Used by executors that handle their own decryption
   */
  async getHotWalletEncryptedKey(chainId: WalletChainId): Promise<string> {
    return this.getEncryptedPrivateKey(chainId, 'hot');
  }

  /**
   * Get funding wallet ENCRYPTED key for a chain
   * Used by executors that handle their own decryption
   */
  async getFundingWalletEncryptedKey(chainId: WalletChainId): Promise<string> {
    return this.getEncryptedPrivateKey(chainId, 'funding');
  }

  /**
   * Internal: Get encrypted private key from DB (no decryption)
   */
  private async getEncryptedPrivateKey(chainId: WalletChainId, walletType: WalletType): Promise<string> {
    const record = await this.prisma.platformKey.findUnique({
      where: { chain_wallet_type_unique: { chain: chainId, walletType } },
    });

    if (!record) {
      throw new NotFoundException(`Platform key not found: ${chainId}/${walletType}`);
    }

    if (!record.encryptedPrivateKey) {
      throw new Error(`No private key stored for ${chainId}/${walletType} (cold wallets don't have keys)`);
    }

    return record.encryptedPrivateKey;
  }

  /**
   * Internal: Get private key from DB and decrypt
   */
  private async getPrivateKey(chainId: WalletChainId, walletType: WalletType): Promise<string> {
    const record = await this.prisma.platformKey.findUnique({
      where: { chain_wallet_type_unique: { chain: chainId, walletType } },
    });

    if (!record) {
      throw new NotFoundException(`Platform key not found: ${chainId}/${walletType}`);
    }

    if (!record.encryptedPrivateKey) {
      throw new Error(`No private key stored for ${chainId}/${walletType} (cold wallets don't have keys)`);
    }

    // Decrypt via KMS - no extra context to ensure consistency
    return this.encryptionService.decrypt(record.encryptedPrivateKey);
  }

  /**
   * Internal: Get address from DB
   */
  private async getAddress(chainId: WalletChainId, walletType: WalletType): Promise<string> {
    const record = await this.prisma.platformKey.findUnique({
      where: { chain_wallet_type_unique: { chain: chainId, walletType } },
    });

    if (!record) {
      throw new NotFoundException(`Platform address not found: ${chainId}/${walletType}`);
    }

    return record.publicAddress;
  }
}
