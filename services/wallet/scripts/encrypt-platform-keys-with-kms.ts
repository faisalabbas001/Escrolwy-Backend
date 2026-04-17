/**
 * Encrypt Platform Keys with KMS
 *
 * This script:
 * 1. Reads locally-encrypted platform keys from .env
 * 2. Decrypts them using local encryption key
 * 3. Re-encrypts them using direct KMS encryption
 * 4. Outputs new values to put in .env
 *
 * Usage:
 *   npx ts-node scripts/encrypt-platform-keys-with-kms.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';
import { KMSClient, EncryptCommand } from '@aws-sdk/client-kms';

// Load .env
config({ path: resolve(__dirname, '../.env') });

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

// AWS KMS client
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Decrypt using local encryption (same as encryption.service.ts)
 */
async function decryptLocal(encryptedData: string): Promise<string> {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY!;
  const combined = Buffer.from(encryptedData, 'base64');

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = (await scryptAsync(encryptionKey, salt, 32)) as Buffer;
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt using direct KMS
 */
async function encryptWithKms(plaintext: string, context: Record<string, string>): Promise<string> {
  const keyId = process.env.AWS_KMS_CMK_ARN!;

  const command = new EncryptCommand({
    KeyId: keyId,
    Plaintext: Buffer.from(plaintext, 'utf8'),
    EncryptionContext: { service: 'escrowly-wallet', ...context },
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

async function main() {
  console.log('=== Encrypt Platform Keys with KMS ===\n');

  // Verify required env vars
  const required = [
    'WALLET_ENCRYPTION_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_KMS_CMK_ARN',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  const keys = [
    { env: 'EVM_HOT_WALLET_KEY', context: { keyType: 'platform', chain: 'evm', wallet: 'hot' } },
    { env: 'EVM_FUNDING_WALLET_KEY', context: { keyType: 'platform', chain: 'evm', wallet: 'funding' } },
    { env: 'SOL_HOT_WALLET_KEY', context: { keyType: 'platform', chain: 'sol', wallet: 'hot' } },
    { env: 'SOL_FUNDING_WALLET_KEY', context: { keyType: 'platform', chain: 'sol', wallet: 'funding' } },
    { env: 'TRC_HOT_WALLET_KEY', context: { keyType: 'platform', chain: 'trc', wallet: 'hot' } },
    { env: 'TRC_FUNDING_WALLET_KEY', context: { keyType: 'platform', chain: 'trc', wallet: 'funding' } },
  ];

  console.log('Processing keys...\n');

  const results: { env: string; kmsEncrypted: string }[] = [];

  for (const { env, context } of keys) {
    const encryptedLocal = process.env[env];

    if (!encryptedLocal) {
      console.log(`⚠ Skipping ${env}: not found in .env`);
      continue;
    }

    try {
      // Decrypt with local encryption
      const plaintext = await decryptLocal(encryptedLocal);

      // Re-encrypt with KMS
      const kmsEncrypted = await encryptWithKms(plaintext, context);

      results.push({ env, kmsEncrypted });
      console.log(`✓ ${env}: encrypted with KMS`);
    } catch (error: any) {
      console.error(`✗ ${env}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('\n=== KMS-Encrypted Keys ===');
  console.log('Copy these to your .env file:\n');

  for (const { env, kmsEncrypted } of results) {
    console.log(`${env}=${kmsEncrypted}`);
  }

  console.log('\n=== Next Steps ===');
  console.log('1. Replace the keys in .env with the values above');
  console.log('2. Change ENCRYPTION_MODE=local to ENCRYPTION_MODE=kms');
  console.log('3. Restart the wallet service');
}

main().catch(console.error);
