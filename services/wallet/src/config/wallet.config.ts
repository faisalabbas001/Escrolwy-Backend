import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type WalletChainId,
  type ListenerChainId,
  getRpcUrl,
  getEvmRpcUrl as getEvmRpcUrlFromConfig,
  RPC_ENV_KEYS,
} from '@escrowly/chain-config';

/**
 * Wallet-specific chain configuration
 * Maps wallet chain IDs to environment variable keys
 */
interface WalletChainEnvConfig {
  hotWalletEnvKey: string;
  hotWalletKeyEnvKey: string;
  coldWalletEnvKey: string;
  fundingWalletKeyEnvKey: string;
  fundingThresholdEnvKey: string;
  fundingAmountEnvKey: string;
  gasMultiplier: number;
}

const WALLET_CHAIN_ENV_CONFIGS: Record<WalletChainId, WalletChainEnvConfig> = {
  evm: {
    hotWalletEnvKey: 'EVM_HOT_WALLET',
    hotWalletKeyEnvKey: 'EVM_HOT_WALLET_KEY',
    coldWalletEnvKey: 'EVM_COLD_WALLET',
    fundingWalletKeyEnvKey: 'EVM_FUNDING_WALLET_KEY',
    fundingThresholdEnvKey: 'EVM_FUNDING_THRESHOLD',
    fundingAmountEnvKey: 'EVM_FUNDING_AMOUNT',
    gasMultiplier: 1.2,
  },
  sol: {
    hotWalletEnvKey: 'SOL_HOT_WALLET',
    hotWalletKeyEnvKey: 'SOL_HOT_WALLET_KEY',
    coldWalletEnvKey: 'SOL_COLD_WALLET',
    fundingWalletKeyEnvKey: 'SOL_FUNDING_WALLET_KEY',
    fundingThresholdEnvKey: 'SOL_FUNDING_THRESHOLD',
    fundingAmountEnvKey: 'SOL_FUNDING_AMOUNT',
    gasMultiplier: 1.0,
  },
  trc: {
    hotWalletEnvKey: 'TRC_HOT_WALLET',
    hotWalletKeyEnvKey: 'TRC_HOT_WALLET_KEY',
    coldWalletEnvKey: 'TRC_COLD_WALLET',
    fundingWalletKeyEnvKey: 'TRC_FUNDING_WALLET_KEY',
    fundingThresholdEnvKey: 'TRC_FUNDING_THRESHOLD',
    fundingAmountEnvKey: 'TRC_FUNDING_AMOUNT',
    gasMultiplier: 1.0,
  },
};

/**
 * Wallet Configuration Service
 *
 * Provides runtime configuration for wallet operations.
 * All values are loaded from environment variables.
 * Uses @escrowly/chain-config for RPC configuration.
 */
@Injectable()
export class WalletConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get hot wallet address for a chain
   */
  getHotWalletAddress(chainId: WalletChainId): string {
    const config = WALLET_CHAIN_ENV_CONFIGS[chainId];
    const address = this.configService.get<string>(config.hotWalletEnvKey);
    if (!address) {
      throw new Error(
        `Hot wallet address not configured for ${chainId}. Set ${config.hotWalletEnvKey}`,
      );
    }
    return address;
  }

  /**
   * Get hot wallet private key for a chain (used for hot-to-cold transfers)
   */
  getHotWalletKey(chainId: WalletChainId): string {
    const config = WALLET_CHAIN_ENV_CONFIGS[chainId];
    const key = this.configService.get<string>(config.hotWalletKeyEnvKey);
    if (!key) {
      throw new Error(
        `Hot wallet key not configured for ${chainId}. Set ${config.hotWalletKeyEnvKey}`,
      );
    }
    return key;
  }

  /**
   * Get cold wallet address for a chain
   */
  getColdWalletAddress(chainId: WalletChainId): string {
    const config = WALLET_CHAIN_ENV_CONFIGS[chainId];
    const address = this.configService.get<string>(config.coldWalletEnvKey);
    if (!address) {
      throw new Error(
        `Cold wallet address not configured for ${chainId}. Set ${config.coldWalletEnvKey}`,
      );
    }
    return address;
  }

  /**
   * Get funding wallet private key for a chain
   */
  getFundingWalletKey(chainId: WalletChainId): string {
    const config = WALLET_CHAIN_ENV_CONFIGS[chainId];
    const key = this.configService.get<string>(config.fundingWalletKeyEnvKey);
    if (!key) {
      throw new Error(
        `Funding wallet key not configured for ${chainId}. Set ${config.fundingWalletKeyEnvKey}`,
      );
    }
    return key;
  }

  /**
   * Get funding threshold for a chain (minimum balance before refunding)
   */
  getFundingThreshold(chainId: WalletChainId): string {
    const config = WALLET_CHAIN_ENV_CONFIGS[chainId];
    return this.configService.get<string>(config.fundingThresholdEnvKey, '0.1');
  }

  /**
   * Get funding amount for a chain (amount to transfer when refunding)
   */
  getFundingAmount(chainId: WalletChainId): string {
    const config = WALLET_CHAIN_ENV_CONFIGS[chainId];
    return this.configService.get<string>(config.fundingAmountEnvKey, '0.5');
  }

  /**
   * Get RPC URL for a wallet chain
   * Uses the shared chain-config package
   */
  getRpcUrl(chainId: WalletChainId): string {
    // Map wallet chain to listener chain for RPC lookup
    const listenerChainMap: Record<WalletChainId, ListenerChainId> = {
      evm: 'eth', // Default to ETH for EVM
      sol: 'sol',
      trc: 'trc',
    };
    const listenerChain = listenerChainMap[chainId];
    return getRpcUrl(listenerChain, (k) => this.configService.get<string>(k));
  }

  /**
   * Get RPC URL for a specific EVM network
   * Uses the shared chain-config package
   */
  getEvmRpcUrl(network: 'eth' | 'bnb' | 'poly'): string {
    return getEvmRpcUrlFromConfig(network, (k) =>
      this.configService.get<string>(k),
    );
  }

  /**
   * Get gas multiplier for a chain
   */
  getGasMultiplier(chainId: WalletChainId): number {
    const config = WALLET_CHAIN_ENV_CONFIGS[chainId];
    return config.gasMultiplier;
  }

  /**
   * Get encryption mode (local or kms)
   */
  getEncryptionMode(): 'local' | 'kms' {
    return this.configService.get<string>('ENCRYPTION_MODE', 'local') as
      | 'local'
      | 'kms';
  }

  /**
   * Get local encryption key (for local mode)
   */
  getEncryptionKey(): string {
    const key = this.configService.get<string>('WALLET_ENCRYPTION_KEY');
    if (!key && this.getEncryptionMode() === 'local') {
      throw new Error(
        'WALLET_ENCRYPTION_KEY is required when ENCRYPTION_MODE=local',
      );
    }
    return key || '';
  }

  /**
   * Get withdrawal retry cron expression
   */
  getWithdrawalRetryCron(): string {
    return this.configService.get<string>(
      'WITHDRAWAL_RETRY_CRON',
      '*/30 * * * * *',
    );
  }

  /**
   * Get deposit sweep cron expression
   */
  getDepositSweepCron(): string {
    return this.configService.get<string>(
      'DEPOSIT_SWEEP_CRON',
      '0 */5 * * * *',
    );
  }

  /**
   * Get Redis URL
   */
  getRedisUrl(): string {
    return this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
  }

  /**
   * Get Kafka brokers
   */
  getKafkaBrokers(): string {
    return this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092');
  }

  /**
   * Check if Kafka is enabled
   */
  isKafkaEnabled(): boolean {
    return this.configService.get<string>('KAFKA_ENABLED', 'true') === 'true';
  }

  // =============================================================================
  // HOT-TO-COLD WALLET CONFIGURATION
  // =============================================================================

  /**
   * Get hot-to-cold threshold for a token (in human-readable units)
   * When hot wallet balance exceeds this, transfer to cold wallet
   */
  getHotToColdThreshold(token: string): string {
    const envKey = `HOT_TO_COLD_THRESHOLD_${token.toUpperCase()}`;
    return this.configService.get<string>(envKey, '2500');
  }

  /**
   * Get transfer percentage for hot-to-cold transfers
   * Percentage of balance to transfer when threshold is exceeded
   */
  getHotToColdTransferPercent(): number {
    const percent = this.configService.get<string>('HOT_TO_COLD_TRANSFER_PERCENT', '50');
    return parseFloat(percent);
  }

  /**
   * Check if hot-to-cold transfers are enabled
   */
  isHotToColdEnabled(): boolean {
    return this.configService.get<string>('HOT_TO_COLD_ENABLED', 'true') === 'true';
  }

  // =============================================================================
  // AWS KMS CONFIGURATION
  // =============================================================================

  /**
   * Get AWS region for KMS and Secrets Manager
   */
  getAwsRegion(): string {
    return this.configService.get<string>('AWS_REGION', 'us-east-1');
  }

  /**
   * Get KMS CMK ARN for encryption
   */
  getKmsCmkArn(): string {
    const arn = this.configService.get<string>('AWS_KMS_CMK_ARN');
    if (!arn && this.getEncryptionMode() === 'kms') {
      throw new Error('AWS_KMS_CMK_ARN is required when ENCRYPTION_MODE=kms');
    }
    return arn || '';
  }

  /**
   * Get Secrets Manager secret name for platform keys
   */
  getSecretsManagerSecretName(): string {
    const secretName = this.configService.get<string>(
      'AWS_SECRETS_MANAGER_SECRET',
      'escrowly-platform-wallet-keys',
    );
    return secretName;
  }
}
