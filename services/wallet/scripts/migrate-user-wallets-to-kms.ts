/**
 * Migrate User Wallets to KMS Encryption
 *
 * This script:
 * 1. Reads all user wallets from the database
 * 2. Decrypts their private keys using local AES-256-GCM encryption
 * 3. Re-encrypts with AWS KMS
 * 4. Updates the database with KMS-encrypted keys
 *
 * Prerequisites:
 * - WALLET_ENCRYPTION_KEY must be set (for decrypting old keys)
 * - AWS_KMS_CMK_ARN must be set (for encrypting with KMS)
 * - AWS credentials must be configured
 *
 * Usage:
 *   npx ts-node scripts/migrate-user-wallets-to-kms.ts
 *
 * Add --dry-run to preview without making changes:
 *   npx ts-node scripts/migrate-user-wallets-to-kms.ts --dry-run
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { KMSClient, EncryptCommand } from '@aws-sdk/client-kms';
import { createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';

// Load .env
config({ path: resolve(__dirname, '../.env') });

const scryptAsync = promisify(scrypt);

const prisma = new PrismaClient();
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Local encryption constants (must match original encryption)
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Decrypt a locally encrypted key using AES-256-GCM
 */
async function decryptLocal(encryptedData: string, encryptionKey: string): Promise<string> {
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract parts
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // Derive key from password using scrypt
  const key = (await scryptAsync(encryptionKey, salt, 32)) as Buffer;

  // Create decipher
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  // Decrypt
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt with AWS KMS
 */
async function encryptWithKms(
  plaintext: string,
  context: Record<string, string>,
): Promise<string> {
  const keyId = process.env.AWS_KMS_CMK_ARN!;

  const command = new EncryptCommand({
    KeyId: keyId,
    Plaintext: Buffer.from(plaintext, 'utf8'),
    EncryptionContext: { service: 'escrowly-wallet', ...context },
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

/**
 * Check if a key is already KMS-encrypted
 * KMS ciphertext starts with 'AQIC' (0x01 0x02 in base64)
 */
function isKmsEncrypted(encryptedData: string): boolean {
  return encryptedData.startsWith('AQIC');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('=== Migrate User Wallets to KMS ===\n');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`AWS_KMS_CMK_ARN: ${process.env.AWS_KMS_CMK_ARN}\n`);

  // Validate required env vars
  const required = ['WALLET_ENCRYPTION_KEY', 'AWS_KMS_CMK_ARN', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY!;

  // Fetch all user wallets
  const wallets = await prisma.userWallet.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${wallets.length} user wallets\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const wallet of wallets) {
    const label = `${wallet.chain}/${wallet.depositAddress.slice(0, 10)}...`;

    // Check if already KMS-encrypted
    if (isKmsEncrypted(wallet.encryptedPrivateKey)) {
      console.log(`${label}: Already KMS-encrypted, skipping`);
      skipped++;
      continue;
    }

    try {
      // Decrypt with local encryption
      const privateKey = await decryptLocal(wallet.encryptedPrivateKey, encryptionKey);

      // Re-encrypt with KMS
      const kmsEncrypted = await encryptWithKms(privateKey, {
        keyType: 'user',
        chain: wallet.chain,
        walletId: wallet.id,
      });

      if (isDryRun) {
        console.log(`${label}: Would migrate (key length: ${privateKey.length} chars)`);
      } else {
        // Update database
        await prisma.userWallet.update({
          where: { id: wallet.id },
          data: { encryptedPrivateKey: kmsEncrypted },
        });
        console.log(`${label}: Migrated to KMS`);
      }

      migrated++;
    } catch (error: any) {
      console.error(`${label}: FAILED - ${error.message}`);
      failed++;
    }
  }

  console.log('\n=== Results ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already KMS): ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (isDryRun) {
    console.log('\nThis was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }

  if (failed === 0 && !isDryRun) {
    console.log('\nAll user wallets successfully migrated to KMS!');
  } else if (failed > 0) {
    console.log('\nSome wallets failed migration!');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
