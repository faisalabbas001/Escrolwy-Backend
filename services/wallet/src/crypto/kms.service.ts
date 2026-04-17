import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
  DescribeKeyCommand,
} from '@aws-sdk/client-kms';
import { WalletConfigService } from '../config';

/**
 * KMS Service
 *
 * Handles AWS KMS direct encryption/decryption for private keys.
 * Since private keys are small (32-64 bytes), we use direct KMS encryption
 * instead of envelope encryption. This is simpler and equally secure.
 *
 * Flow:
 * - Encrypt: KMS.Encrypt(plaintext) → ciphertext (store in DB)
 * - Decrypt: KMS.Decrypt(ciphertext) → plaintext (use, then wipe)
 */
@Injectable()
export class KmsService implements OnModuleInit {
  private readonly logger = new Logger(KmsService.name);
  private kmsClient: KMSClient | null = null;
  private keyId: string = '';

  constructor(private readonly walletConfig: WalletConfigService) {}

  async onModuleInit(): Promise<void> {
    if (this.walletConfig.getEncryptionMode() !== 'kms') {
      this.logger.log('KMS mode disabled, skipping initialization');
      return;
    }

    const region = this.walletConfig.getAwsRegion();
    this.keyId = this.walletConfig.getKmsCmkArn();
    this.kmsClient = new KMSClient({ region });

    // Retry KMS validation with exponential backoff for transient network issues
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.validateKeyAccess();
        this.logger.log('KMS service initialized successfully (direct encryption mode)');
        return;
      } catch (error: any) {
        lastError = error;
        const isNetworkError = error.message?.includes('ENOTFOUND') ||
                               error.message?.includes('ETIMEDOUT') ||
                               error.message?.includes('ECONNREFUSED');

        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          this.logger.warn(`KMS connection failed (attempt ${attempt}/${maxRetries}), retrying in ${delay/1000}s: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    this.logger.error(`Failed to initialize KMS service after ${maxRetries} attempts: ${lastError?.message}`);
    throw lastError;
  }

  /**
   * Validate that we have access to the KMS key
   */
  private async validateKeyAccess(): Promise<void> {
    if (!this.kmsClient) {
      throw new Error('KMS client not initialized');
    }

    try {
      const command = new DescribeKeyCommand({ KeyId: this.keyId });
      const response = await this.kmsClient.send(command);

      if (response.KeyMetadata?.KeyState !== 'Enabled') {
        throw new Error(`KMS key is not enabled (state: ${response.KeyMetadata?.KeyState})`);
      }

      this.logger.log(`Validated KMS key: ${response.KeyMetadata?.KeyId}`);
    } catch (error: any) {
      this.logger.error(`Failed to validate KMS key: ${error.message}`);
      throw new Error(`KMS key validation failed: ${error.message}`);
    }
  }

  /**
   * Encrypt data using KMS directly
   *
   * @param plaintext - The data to encrypt (e.g., private key)
   * @param context - Optional encryption context for audit trail
   * @returns Base64-encoded ciphertext
   */
  async encrypt(plaintext: string, context?: Record<string, string>): Promise<string> {
    if (!this.kmsClient) {
      throw new Error('KMS client not initialized. Is ENCRYPTION_MODE=kms?');
    }

    const encryptionContext = {
      service: 'escrowly-wallet',
      ...context,
    };

    try {
      const command = new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: Buffer.from(plaintext, 'utf8'),
        EncryptionContext: encryptionContext,
      });

      const response = await this.kmsClient.send(command);

      if (!response.CiphertextBlob) {
        throw new Error('KMS Encrypt returned empty ciphertext');
      }

      return Buffer.from(response.CiphertextBlob).toString('base64');
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        name: error.name,
        code: error.Code || error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        fault: error.$fault,
        context: encryptionContext,
      };

      this.logger.error(`KMS encryption failed: ${JSON.stringify(errorDetails, null, 2)}`);
      throw new Error(`Failed to encrypt with KMS: ${error.name || 'Unknown'} - ${error.message || 'No message'} (code: ${error.Code || error.code || 'none'})`);
    }
  }

  /**
   * Decrypt data using KMS directly
   *
   * @param ciphertext - Base64-encoded ciphertext from encrypt()
   * @param context - Same encryption context used during encryption
   * @returns Decrypted plaintext
   */
  async decrypt(ciphertext: string, context?: Record<string, string>): Promise<string> {
    if (!this.kmsClient) {
      throw new Error('KMS client not initialized. Is ENCRYPTION_MODE=kms?');
    }

    const encryptionContext = {
      service: 'escrowly-wallet',
      ...context,
    };

    // Log input details for debugging
    this.logger.debug(`KMS decrypt request - context: ${JSON.stringify(context)}, ciphertext length: ${ciphertext.length}, starts with: ${ciphertext.slice(0, 8)}...`);

    try {
      const command = new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: Buffer.from(ciphertext, 'base64'),
        EncryptionContext: encryptionContext,
      });

      const response = await this.kmsClient.send(command);

      if (!response.Plaintext) {
        throw new Error('KMS Decrypt returned empty plaintext');
      }

      return Buffer.from(response.Plaintext).toString('utf8');
    } catch (error: any) {
      // Extract detailed AWS error information
      const errorDetails = {
        message: error.message,
        name: error.name,
        code: error.Code || error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        fault: error.$fault,
        context: encryptionContext,
        ciphertextPrefix: ciphertext.slice(0, 20) + '...',
        ciphertextLength: ciphertext.length,
      };

      this.logger.error(`KMS decryption failed: ${JSON.stringify(errorDetails, null, 2)}`);
      throw new Error(`Failed to decrypt with KMS: ${error.name || 'Unknown'} - ${error.message || 'No message'} (code: ${error.Code || error.code || 'none'})`);
    }
  }

  /**
   * Check if KMS is initialized and ready
   */
  isInitialized(): boolean {
    return this.kmsClient !== null;
  }
}
