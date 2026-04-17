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
   * Get database URL with credentials injected from Secrets Manager
   *
   * The DATABASE_URL in .env should have placeholders:
   * postgresql://USERNAME:PASSWORD@host:port/db?schema=...
   *
   * This method:
   * 1. Reads DATABASE_URL from .env (with USERNAME:PASSWORD placeholders)
   * 2. Fetches actual username/password from AWS Secrets Manager (using DB_SECRET_ARN)
   * 3. Replaces placeholders with real credentials
   * 4. Returns the final connection string
   *
   * Why? AWS rotates database credentials automatically. Hardcoding them would break after rotation.
   *
   * @returns Complete database connection string with credentials
   */
  async getDatabaseUrl(): Promise<string> {
    const dbUrlTemplate = this.config.get<string>("DATABASE_URL");
    if (!dbUrlTemplate) {
      throw new Error("DATABASE_URL not configured in environment variables");
    }

    // If URL doesn't contain placeholders, return as-is (local dev with static credentials)
    // But adjust host for local development (replace Docker service name with localhost)
    if (
      !dbUrlTemplate.includes("USERNAME") &&
      !dbUrlTemplate.includes("PASSWORD")
    ) {
      // When running locally (not in Docker), replace 'postgres:5432' with 'localhost:5433'
      // This allows the same .env to work in both Docker and local dev
      let finalUrl = dbUrlTemplate;
      
      // Check if we're running locally (not in Docker container)
      // Docker containers can be detected by checking if hostname matches service name
      // or by checking if we can resolve 'postgres' hostname (only works in Docker network)
      const isLocalDev = process.env.NODE_ENV === 'development' && 
                        !process.env.DOCKER_CONTAINER &&
                        process.env.HOSTNAME !== 'escrowly-auth' &&
                        process.env.HOSTNAME !== 'escrowly-admin' &&
                        process.env.HOSTNAME !== 'escrowly-bff';
      
      if (isLocalDev) {
        // Replace Docker service names with localhost and mapped ports
        // postgres:5432 -> localhost:5433 (Docker maps 5432 to 5433 on host)
        finalUrl = finalUrl.replace(/postgres:5432/g, 'localhost:5433');
        finalUrl = finalUrl.replace(/postgres:5433/g, 'localhost:5433');
      }
      
      return finalUrl;
    }

    // Get database secret ARN from environment
    const dbSecretArn = this.config.get<string>("DB_SECRET_ARN");
    if (!dbSecretArn) {
      throw new Error(
        "DB_SECRET_ARN not configured. Required when DATABASE_URL contains USERNAME:PASSWORD placeholders."
      );
    }

    // Fetch credentials from Secrets Manager
    const credentials = await this.getDatabaseCredentials(dbSecretArn);

    // Replace placeholders in connection string
    // Use split/join to avoid any regex issues with special characters in password
    const encodedUsername = encodeURIComponent(credentials.username);
    const encodedPassword = encodeURIComponent(credentials.password);

    // Split by USERNAME and PASSWORD, then join with encoded values
    // This is safer than replace() when dealing with special characters
    let finalUrl = dbUrlTemplate;

    // Replace USERNAME first
    const parts = finalUrl.split("USERNAME");
    if (parts.length === 2) {
      finalUrl = parts[0] + encodedUsername + parts[1];
    }

    // Replace PASSWORD second
    const passwordParts = finalUrl.split("PASSWORD");
    if (passwordParts.length === 2) {
      finalUrl = passwordParts[0] + encodedPassword + passwordParts[1];
    }

    return finalUrl;
  }

  /**
   * Get database credentials from AWS Secrets Manager
   *
   * @param secretArn - ARN of the secret containing database credentials
   * @returns Object with username and password
   */
  private async getDatabaseCredentials(secretArn: string): Promise<{
    username: string;
    password: string;
  }> {
    try {
      // Use Secrets Manager client (works in both local dev and stage/prod)
      const region = this.config.get<string>("AWS_REGION", "us-east-1");
      const client = new SecretsManagerClient({ region });

      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await client.send(command);

      if (!response.SecretString) {
        throw new Error("Database secret value is empty");
      }

      const secret = JSON.parse(response.SecretString);

      if (!secret.username || !secret.password) {
        throw new Error(
          "Database secret must contain 'username' and 'password' fields"
        );
      }

      // Get raw password value
      // Aurora Secrets Manager returns the password as a plain string
      // We'll URL-encode it when building the connection string
      const username = String(secret.username);
      const password = String(secret.password);

      // Log for debugging (remove in production)
      this.logger.debug(
        `Fetched DB credentials - Username: ${username}, Password length: ${password.length}`
      );

      return {
        username,
        password,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch database credentials from Secrets Manager: ${secretArn}`,
        error
      );
      throw new Error(
        `Failed to fetch database credentials: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get Redis URL
   * Automatically adjusts for local development (replaces Docker service names)
   * Provides default value for local development if not configured
   */
  getRedisUrl(): string {
    // Check if we're running locally (not in Docker container)
    const isLocalDev = process.env.NODE_ENV === 'development' && 
                      !process.env.DOCKER_CONTAINER &&
                      process.env.HOSTNAME !== 'escrowly-auth' &&
                      process.env.HOSTNAME !== 'escrowly-admin' &&
                      process.env.HOSTNAME !== 'escrowly-bff';
    
    // Get Redis URL with default for local dev
    // Default includes password from docker-compose (escrowly_redis_password)
    const defaultRedisUrl = isLocalDev 
      ? 'redis://:escrowly_redis_password@localhost:6379'
      : 'redis://localhost:6379';
    
    let redisUrl = this.getSecret("REDIS_URL", defaultRedisUrl);
    
    if (isLocalDev && redisUrl) {
      // Replace Docker service names with localhost
      // redis:6379 -> localhost:6379
      redisUrl = redisUrl.replace(/redis:6379/g, 'localhost:6379');
      // If Redis URL has password but we're local, ensure it's included
      // Format: redis://:password@host:port
      if (redisUrl.includes('redis://') && !redisUrl.includes('@localhost') && redisUrl.includes('@redis')) {
        redisUrl = redisUrl.replace('@redis', '@localhost');
      }
    }
    
    return redisUrl;
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
