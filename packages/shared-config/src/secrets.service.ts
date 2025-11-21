import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

/**
 * Shared Secrets Service
 *
 * Used by ALL Escrowly microservices (auth, wallet, ledger, etc.)
 *
 * Strategy:
 * - Local Dev: Reads from .env file (even when using AWS Aurora/KMS/S3)
 * - Stage/Prod: Fetches from AWS Secrets Manager
 *
 * Why this approach?
 * - Code doesn't change between environments
 * - Local dev uses standard .env (easy, no AWS credentials needed for secrets)
 * - Stage/prod use Secrets Manager (secure, centralized)
 * - Single source of truth - shared across all services
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private secretsCache: Map<string, string> = new Map();
  private secretsManagerClient: SecretsManagerClient | null = null;
  private readonly useSecretsManager: boolean;

  constructor(private readonly config: ConfigService) {
    // Determine if we should use Secrets Manager
    // Use Secrets Manager ONLY in stage/prod environments
    // Local dev (even with AWS Aurora/KMS/S3) uses .env
    const secretsManagerArn = this.config.get<string>(
      "AWS_SECRETS_MANAGER_ARN"
    );
    const nodeEnv = this.config.get<string>("NODE_ENV", "development");

    // Use Secrets Manager if:
    // 1. ARN is provided AND
    // 2. ARN is not "dummy" AND
    // 3. Environment is stage or production (NOT development)
    this.useSecretsManager =
      !!secretsManagerArn &&
      !secretsManagerArn.includes("dummy") &&
      (nodeEnv === "stage" || nodeEnv === "production");

    if (this.useSecretsManager) {
      const region = this.config.get<string>("AWS_REGION", "us-east-1");
      this.secretsManagerClient = new SecretsManagerClient({ region });
      this.logger.log("🔐 Using AWS Secrets Manager for secrets");
    } else {
      this.logger.log("📝 Using .env file for secrets (local development)");
    }
  }

  /**
   * Initialize secrets on module start
   * Fetches all secrets from Secrets Manager if enabled
   */
  async onModuleInit() {
    if (this.useSecretsManager) {
      await this.loadSecretsFromManager();
    }
  }

  /**
   * Load all secrets from AWS Secrets Manager
   * Caches them in memory for performance
   */
  private async loadSecretsFromManager(): Promise<void> {
    try {
      const secretArn = this.config.get<string>("AWS_SECRETS_MANAGER_ARN");
      if (!secretArn) {
        throw new Error("AWS_SECRETS_MANAGER_ARN not configured");
      }

      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await this.secretsManagerClient!.send(command);

      if (!response.SecretString) {
        throw new Error("Secret value is empty");
      }

      const secrets = JSON.parse(response.SecretString);

      // Cache all secrets
      Object.entries(secrets).forEach(([key, value]) => {
        this.secretsCache.set(key, value as string);
      });

      this.logger.log(
        `✅ Loaded ${this.secretsCache.size} secrets from Secrets Manager`
      );
    } catch (error) {
      this.logger.error(
        "❌ Failed to load secrets from Secrets Manager",
        error
      );
      // In stage/prod, fail fast (no fallback)
      throw error;
    }
  }

  /**
   * Get a secret value
   *
   * Priority:
   * 1. Secrets Manager (if enabled and secret exists)
   * 2. Environment variable (from .env)
   * 3. Default value (if provided)
   *
   * @param key - Secret key name
   * @param defaultValue - Optional default value if secret not found
   * @returns Secret value
   */
  getSecret(key: string, defaultValue?: string): string {
    // Try Secrets Manager cache first (stage/prod)
    if (this.useSecretsManager && this.secretsCache.has(key)) {
      return this.secretsCache.get(key)!;
    }

    // Fallback to environment variable (from .env) - local dev
    const envValue = this.config.get<string>(key);
    if (envValue) {
      return envValue;
    }

    // Use default if provided
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    // Throw error if secret is required but not found
    throw new Error(
      `Secret '${key}' not found in Secrets Manager or environment variables`
    );
  }

  /**
   * Get JWT secret
   */
  getJwtSecret(): string {
    return this.getSecret("JWT_SECRET");
  }

  /**
   * Get database URL
   */
  getDatabaseUrl(): string {
    return this.getSecret("DATABASE_URL");
  }

  /**
   * Get Redis URL
   */
  getRedisUrl(): string {
    return this.getSecret("REDIS_URL");
  }

  /**
   * Get Kafka brokers
   */
  getKafkaBrokers(): string {
    return this.getSecret("KAFKA_BROKERS");
  }

  /**
   * Get AWS KMS Key ARN
   */
  getKmsKeyArn(): string {
    return this.getSecret("AWS_KMS_KEY_ARN");
  }

  /**
   * Get S3 bucket name
   */
  getS3Bucket(): string {
    return this.getSecret("AWS_S3_BUCKET");
  }

  /**
   * Get SMTP password (for email)
   */
  getSmtpPassword(): string {
    return this.getSecret("SMTP_PASSWORD", "");
  }

  /**
   * Check if using Secrets Manager
   */
  isUsingSecretsManager(): boolean {
    return this.useSecretsManager;
  }
}
