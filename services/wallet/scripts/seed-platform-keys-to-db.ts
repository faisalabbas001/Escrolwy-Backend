/**
 * Seed Platform Keys to Database
 *
 * This script:
 * 1. Reads KMS-encrypted platform keys from .env
 * 2. Reads wallet addresses from .env
 * 3. Inserts them into the platform_keys table
 *
 * Usage:
 *   npx ts-node scripts/seed-platform-keys-to-db.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

interface PlatformKeyData {
  chain: string;
  walletType: string;
  addressEnvKey: string;
  keyEnvKey: string | null; // null for cold wallets
}

const PLATFORM_KEYS: PlatformKeyData[] = [
  // EVM
  { chain: 'evm', walletType: 'hot', addressEnvKey: 'EVM_HOT_WALLET', keyEnvKey: 'EVM_HOT_WALLET_KEY' },
  { chain: 'evm', walletType: 'funding', addressEnvKey: 'EVM_HOT_WALLET', keyEnvKey: 'EVM_FUNDING_WALLET_KEY' },
  { chain: 'evm', walletType: 'cold', addressEnvKey: 'EVM_COLD_WALLET', keyEnvKey: null },
  // SOL
  { chain: 'sol', walletType: 'hot', addressEnvKey: 'SOL_HOT_WALLET', keyEnvKey: 'SOL_HOT_WALLET_KEY' },
  { chain: 'sol', walletType: 'funding', addressEnvKey: 'SOL_HOT_WALLET', keyEnvKey: 'SOL_FUNDING_WALLET_KEY' },
  { chain: 'sol', walletType: 'cold', addressEnvKey: 'SOL_COLD_WALLET', keyEnvKey: null },
  // TRC
  { chain: 'trc', walletType: 'hot', addressEnvKey: 'TRC_HOT_WALLET', keyEnvKey: 'TRC_HOT_WALLET_KEY' },
  { chain: 'trc', walletType: 'funding', addressEnvKey: 'TRC_HOT_WALLET', keyEnvKey: 'TRC_FUNDING_WALLET_KEY' },
  { chain: 'trc', walletType: 'cold', addressEnvKey: 'TRC_COLD_WALLET', keyEnvKey: null },
];

async function main() {
  console.log('=== Seed Platform Keys to Database ===\n');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const { chain, walletType, addressEnvKey, keyEnvKey } of PLATFORM_KEYS) {
    const publicAddress = process.env[addressEnvKey];
    const encryptedPrivateKey = keyEnvKey ? process.env[keyEnvKey] : null;

    if (!publicAddress) {
      console.log(`⚠ Skipping ${chain}/${walletType}: ${addressEnvKey} not found in .env`);
      skipped++;
      continue;
    }

    if (keyEnvKey && !encryptedPrivateKey) {
      console.log(`⚠ Skipping ${chain}/${walletType}: ${keyEnvKey} not found in .env`);
      skipped++;
      continue;
    }

    try {
      // Check if already exists
      const existing = await prisma.platformKey.findUnique({
        where: { chain_wallet_type_unique: { chain, walletType } },
      });

      if (existing) {
        console.log(`○ ${chain}/${walletType}: already exists, updating...`);
        await prisma.platformKey.update({
          where: { chain_wallet_type_unique: { chain, walletType } },
          data: {
            publicAddress,
            encryptedPrivateKey,
          },
        });
        console.log(`  ✓ Updated`);
      } else {
        await prisma.platformKey.create({
          data: {
            chain,
            walletType,
            publicAddress,
            encryptedPrivateKey,
          },
        });
        console.log(`✓ ${chain}/${walletType}: created`);
      }
      created++;
    } catch (error: any) {
      console.error(`✗ ${chain}/${walletType}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Created/Updated: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  // Verify by listing all
  console.log('\n=== Current Platform Keys ===');
  const allKeys = await prisma.platformKey.findMany({
    orderBy: [{ chain: 'asc' }, { walletType: 'asc' }],
  });

  for (const key of allKeys) {
    const keyStatus = key.encryptedPrivateKey ? '🔐 has key' : '📭 no key';
    console.log(`${key.chain}/${key.walletType}: ${key.publicAddress.slice(0, 10)}... ${keyStatus}`);
  }

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
