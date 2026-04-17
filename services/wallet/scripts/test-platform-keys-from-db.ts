/**
 * Test Platform Keys from Database
 *
 * Verifies that platform keys can be:
 * 1. Fetched from the database
 * 2. Decrypted via KMS
 *
 * Usage:
 *   npx ts-node scripts/test-platform-keys-from-db.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

// Load .env
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function decryptWithKms(ciphertext: string, context: Record<string, string>): Promise<string> {
  const keyId = process.env.AWS_KMS_CMK_ARN!;

  const command = new DecryptCommand({
    KeyId: keyId,
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    EncryptionContext: { service: 'escrowly-wallet', ...context },
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!).toString('utf8');
}

async function main() {
  console.log('=== Test Platform Keys from Database ===\n');
  console.log(`ENCRYPTION_MODE: ${process.env.ENCRYPTION_MODE}`);
  console.log(`AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`AWS_KMS_CMK_ARN: ${process.env.AWS_KMS_CMK_ARN}\n`);

  // Fetch all platform keys from database
  const platformKeys = await prisma.platformKey.findMany({
    orderBy: [{ chain: 'asc' }, { walletType: 'asc' }],
  });

  console.log(`Found ${platformKeys.length} platform keys in database\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of platformKeys) {
    const label = `${key.chain}/${key.walletType}`;

    // Check address
    console.log(`${label}:`);
    console.log(`  Address: ${key.publicAddress}`);

    // Check if has private key
    if (!key.encryptedPrivateKey) {
      console.log(`  Key: (none - cold wallet)`);
      skipped++;
      continue;
    }

    // Try to decrypt
    try {
      const decrypted = await decryptWithKms(key.encryptedPrivateKey, {
        keyType: 'platform',
        chain: key.chain,
        wallet: key.walletType,
      });

      const preview = decrypted.length > 10
        ? `${decrypted.slice(0, 4)}...${decrypted.slice(-4)} (${decrypted.length} chars)`
        : `${decrypted.length} chars`;

      console.log(`  Key: ✓ decrypted - ${preview}`);
      success++;
    } catch (error: any) {
      console.log(`  Key: ✗ FAILED - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Success: ${success}`);
  console.log(`Skipped (cold): ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✓ All platform keys working correctly!');
  } else {
    console.log('\n✗ Some keys failed decryption!');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
