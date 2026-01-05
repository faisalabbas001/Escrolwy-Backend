import { Injectable, Logger } from '@nestjs/common';
import { KmsService } from './kms.service';

/**
 * Encryption Service
 *
 * Handles encryption/decryption of private keys using AWS KMS.
 * All private keys are encrypted directly by KMS.
 * No envelope encryption needed since keys are small (32-64 bytes).
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);

  constructor(private readonly kmsService: KmsService) {}

  /**
   * Encrypt a private key using KMS
   *
   * @param privateKey - The private key to encrypt
   * @param context - Optional context for KMS audit trail
   */
  async encrypt(
    privateKey: string,
    context?: Record<string, string>,
  ): Promise<string> {
    return this.kmsService.encrypt(privateKey, context);
  }

  /**
   * Decrypt a private key using KMS
   *
   * @param encryptedData - The KMS-encrypted data to decrypt
   * @param context - Same context used during encryption
   */
  async decrypt(
    encryptedData: string,
    context?: Record<string, string>,
  ): Promise<string> {
    return this.kmsService.decrypt(encryptedData, context);
  }
}
