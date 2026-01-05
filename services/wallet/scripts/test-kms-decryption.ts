/**
 * Test KMS Decryption
 *
 * Verifies that all encrypted keys in the database can be decrypted successfully.
 *
 * Usage:
 *   npx ts-node scripts/test-kms-decryption.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';

// Load .env
config({ path: resolve(__dirname, '../.env') });

const TronWeb = require('tronweb');

const prisma = new PrismaClient();
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Decrypt with AWS KMS
 */
async function decryptWithKms(ciphertext: string): Promise<string> {
  const keyId = process.env.AWS_KMS_CMK_ARN!;

  const command = new DecryptCommand({
    KeyId: keyId,
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    EncryptionContext: { service: 'escrowly-wallet' },
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!).toString('utf8');
}

/**
 * Derive EVM address from private key
 */
function deriveEvmAddress(privateKeyHex: string): string {
  const key = privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`;
  const wallet = new ethers.Wallet(key);
  return wallet.address;
}

/**
 * Derive Solana address from private key (base64 format)
 */
function deriveSolanaAddress(privateKeyBase64: string): string {
  const secretKey = Buffer.from(privateKeyBase64, 'base64');
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  return keypair.publicKey.toBase58();
}

/**
 * Derive Tron address from private key
 */
function deriveTronAddress(privateKeyHex: string): string {
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
  return tronWeb.address.fromPrivateKey(privateKeyHex);
}

async function main() {
  console.log('=== Test KMS Decryption ===\n');

  let passed = 0;
  let failed = 0;

  // Test platform keys
  console.log('Testing Platform Keys:\n');
  const platformKeys = await prisma.platformKey.findMany({
    where: { encryptedPrivateKey: { not: null } },
    orderBy: [{ chain: 'asc' }, { walletType: 'asc' }],
  });

  for (const key of platformKeys) {
    const label = `${key.chain}/${key.walletType}`;
    try {
      const decrypted = await decryptWithKms(key.encryptedPrivateKey!);

      // Verify address matches
      let derivedAddress: string;
      if (key.chain === 'evm') {
        derivedAddress = deriveEvmAddress(decrypted);
      } else if (key.chain === 'sol') {
        derivedAddress = deriveSolanaAddress(decrypted);
      } else {
        derivedAddress = deriveTronAddress(decrypted);
      }

      if (derivedAddress.toLowerCase() === key.publicAddress.toLowerCase()) {
        console.log(`  ✓ ${label}: Decryption OK, address verified`);
        passed++;
      } else {
        console.log(`  ✗ ${label}: Address mismatch! Expected ${key.publicAddress}, got ${derivedAddress}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ✗ ${label}: Decryption FAILED - ${error.message}`);
      failed++;
    }
  }

  // Test user wallets
  console.log('\nTesting User Wallets:\n');
  const userWallets = await prisma.userWallet.findMany({
    orderBy: { chain: 'asc' },
  });

  for (const wallet of userWallets) {
    const label = `${wallet.chain}/${wallet.depositAddress.slice(0, 10)}...`;
    try {
      const decrypted = await decryptWithKms(wallet.encryptedPrivateKey);

      // Verify address matches
      let derivedAddress: string;
      if (wallet.chain === 'evm') {
        derivedAddress = deriveEvmAddress(decrypted);
      } else if (wallet.chain === 'sol') {
        derivedAddress = deriveSolanaAddress(decrypted);
      } else {
        derivedAddress = deriveTronAddress(decrypted);
      }

      if (derivedAddress.toLowerCase() === wallet.depositAddress.toLowerCase()) {
        console.log(`  ✓ ${label}: Decryption OK, address verified`);
        passed++;
      } else {
        console.log(`  ✗ ${label}: Address mismatch! Expected ${wallet.depositAddress}, got ${derivedAddress}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`  ✗ ${label}: Decryption FAILED - ${error.message}`);
      failed++;
    }
  }

  console.log('\n=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✓ All KMS decryption tests passed!');
  } else {
    console.log('\n✗ Some tests failed!');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
