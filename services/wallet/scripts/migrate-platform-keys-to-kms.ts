/**
 * Migrate Platform Keys to KMS
 *
 * This script:
 * 1. Reads locally-encrypted platform keys from .env
 * 2. Decrypts them using local encryption key
 * 3. Re-encrypts them using KMS envelope encryption
 * 4. Stores them in AWS Secrets Manager
 *
 * Usage:
 *   npx ts-node scripts/migrate-platform-keys-to-kms.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import {
  KMSClient,
  GenerateDataKeyCommand,
} from '@aws-sdk/client-kms';
import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Load .env
config({ path: resolve(__dirname, '../.env') });

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const VERSION_KMS = 0x02;

// AWS clients
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const secretsClient = new SecretsManagerClient({
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
 * Encrypt using KMS envelope encryption (same as encryption.service.ts)
 */
async function encryptWithKms(plaintext: string, context: Record<string, string>): Promise<string> {
  const kmsKeyId = process.env.AWS_KMS_CMK_ARN!;

  // Generate data key from KMS
  const genCmd = new GenerateDataKeyCommand({
    KeyId: kmsKeyId,
    KeySpec: 'AES_256',
    EncryptionContext: { service: 'escrowly-wallet', ...context },
  });
  const genRes = await kmsClient.send(genCmd);

  const dataKey = Buffer.from(genRes.Plaintext!);
  const encryptedDek = Buffer.from(genRes.CiphertextBlob!);

  // Generate IV
  const iv = randomBytes(IV_LENGTH);

  // Encrypt with data key
  const cipher = createCipheriv(ALGORITHM, dataKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Clear data key from memory
  dataKey.fill(0);

  // Build payload: version(1) + dekLen(2) + encryptedDek(dekLen) + iv(16) + tag(16) + ciphertext(*)
  const dekLength = encryptedDek.length;
  const payload = Buffer.alloc(1 + 2 + dekLength + IV_LENGTH + TAG_LENGTH + encrypted.length);

  let offset = 0;
  payload.writeUInt8(VERSION_KMS, offset); offset += 1;
  payload.writeUInt16BE(dekLength, offset); offset += 2;
  encryptedDek.copy(payload, offset); offset += dekLength;
  iv.copy(payload, offset); offset += IV_LENGTH;
  tag.copy(payload, offset); offset += TAG_LENGTH;
  encrypted.copy(payload, offset);

  return payload.toString('base64');
}

async function main() {
  console.log('=== Platform Keys Migration to KMS ===\n');

  // Verify required env vars
  const required = [
    'WALLET_ENCRYPTION_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_KMS_CMK_ARN',
    'AWS_SECRETS_MANAGER_SECRET',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  const chains = ['EVM', 'SOL', 'TRC'] as const;
  const keyTypes = ['HOT_WALLET_KEY', 'FUNDING_WALLET_KEY'] as const;

  const secretPayload: Record<string, string> = {};

  for (const chain of chains) {
    for (const keyType of keyTypes) {
      const envKey = `${chain}_${keyType}`;
      const encryptedLocal = process.env[envKey];

      if (!encryptedLocal) {
        console.log(`⚠ Skipping ${envKey}: not found in .env`);
        continue;
      }

      console.log(`Processing ${envKey}...`);

      try {
        // Decrypt with local encryption
        const plaintext = await decryptLocal(encryptedLocal);
        console.log(`  ✓ Decrypted (${plaintext.length} chars)`);

        // Re-encrypt with KMS
        const kmsEncrypted = await encryptWithKms(plaintext, {
          keyType: 'platform',
          chain: chain.toLowerCase(),
        });
        console.log(`  ✓ Encrypted with KMS (${kmsEncrypted.length} chars)`);

        secretPayload[envKey] = kmsEncrypted;
      } catch (error: any) {
        console.error(`  ✗ Failed: ${error.message}`);
        process.exit(1);
      }
    }
  }

  // Store in Secrets Manager
  const secretName = process.env.AWS_SECRETS_MANAGER_SECRET!;
  console.log(`\nStoring in Secrets Manager: ${secretName}`);

  try {
    // Try to update existing secret
    try {
      await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
      // Secret exists, update it
      await secretsClient.send(new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: JSON.stringify(secretPayload, null, 2),
      }));
      console.log('✓ Updated existing secret');
    } catch (e: any) {
      if (e.name === 'ResourceNotFoundException') {
        // Secret doesn't exist, create it
        await secretsClient.send(new CreateSecretCommand({
          Name: secretName,
          SecretString: JSON.stringify(secretPayload, null, 2),
          Description: 'Escrowly platform wallet keys (KMS encrypted)',
        }));
        console.log('✓ Created new secret');
      } else {
        throw e;
      }
    }
  } catch (error: any) {
    console.error(`✗ Failed to store in Secrets Manager: ${error.message}`);
    process.exit(1);
  }

  console.log('\n=== Migration Complete ===');
  console.log('\nNext steps:');
  console.log('1. Change ENCRYPTION_MODE=local to ENCRYPTION_MODE=kms in .env');
  console.log('2. Restart the wallet service');
  console.log('3. Test platform key operations (withdrawals, hot-to-cold transfers)');
}

main().catch(console.error);
