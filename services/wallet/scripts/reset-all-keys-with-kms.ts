/**
 * Reset All Keys with KMS Encryption
 *
 * This script:
 * 1. Deletes all platform_keys and user_wallets from DB
 * 2. Derives addresses from provided private keys
 * 3. Encrypts all keys with KMS
 * 4. Saves fresh data to DB
 *
 * Usage:
 *   npx ts-node scripts/reset-all-keys-with-kms.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { KMSClient, EncryptCommand } from '@aws-sdk/client-kms';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
const bs58 = require('bs58');

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

// ============================================
// PLATFORM KEYS (hot = funding for testing)
// ============================================
const PLATFORM_KEYS = {
  evm: '93480373fc74cc3b4e2cccdab7d07c850428de657485cd6fcb0a3d7669364899',
  sol: 'QU4uiRGSrbnVzbNQi2VRdcFEpFHc6HgFiE1PvVeYwWMpr4cPqfWGkNQvbA2UuwKp38CpPvSkx6dqWXtoBtLf2Ui',
  trc: '57a2947ab6072bca4ac2ff4f8943d4278997fcaa4af654f0ac41cd0012d1dea6',
};

// Cold wallet addresses (receive-only, no private keys)
const COLD_ADDRESSES = {
  evm: '0x759FF633A25C1e66FDEF9CBb36DaD2ceADbdBf8d',
  sol: '8qxYCiRgYW2wCEYMDdxSaMMnXbYndXwb2xUoyTJs1ek5',
  trc: 'TUUgqMTdYPRz3Kz2s2mriqMwm3iWqHYxey',
};

// ============================================
// USER WALLET KEYS
// ============================================
const USER_WALLET_KEYS = {
  sol: '58cGdUyFymk5EZ4TQDNrpVhpb26xAiVBrkVon9XkfQ3Unk7eDJYHBrrjup6zbXF94syPQnsUCcQoKtLhoPvNSwTE',
  evm: 'd88326d5f312705eb09fa20383b074c23754f91437be357a842b90aaaebe129f',
  trc: '7c5e797c5c00e199ac60e03a567f6c94be9fb417f86856d7bbf81c56a29f2757',
};

// Test user ID for user wallets
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Encrypt with AWS KMS
 * Uses only the base context { service: 'escrowly-wallet' } for consistency
 */
async function encryptWithKms(plaintext: string): Promise<string> {
  const keyId = process.env.AWS_KMS_CMK_ARN!;

  const command = new EncryptCommand({
    KeyId: keyId,
    Plaintext: Buffer.from(plaintext, 'utf8'),
    EncryptionContext: { service: 'escrowly-wallet' },
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
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
 * Derive Solana address from private key (base58 format)
 * Also returns the base64 format for storage
 */
function deriveSolanaAddress(privateKeyBase58: string): { address: string; base64Key: string } {
  // Decode from base58 to get the 64-byte secret key
  const secretKey = bs58.decode(privateKeyBase58);
  const keypair = Keypair.fromSecretKey(secretKey);

  // Convert to base64 for storage (matches wallet-generator.service.ts format)
  const base64Key = Buffer.from(secretKey).toString('base64');

  return {
    address: keypair.publicKey.toBase58(),
    base64Key,
  };
}

/**
 * Derive Tron address from private key
 */
function deriveTronAddress(privateKeyHex: string): string {
  const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
  return tronWeb.address.fromPrivateKey(privateKeyHex);
}

async function main() {
  console.log('=== Reset All Keys with KMS Encryption ===\n');

  // Validate required env vars
  const required = ['AWS_KMS_CMK_ARN', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`AWS_KMS_CMK_ARN: ${process.env.AWS_KMS_CMK_ARN}\n`);

  // ============================================
  // Step 1: Delete existing data
  // ============================================
  console.log('Step 1: Deleting existing data...');

  const deletedPlatformKeys = await prisma.platformKey.deleteMany({});
  console.log(`  Deleted ${deletedPlatformKeys.count} platform keys`);

  const deletedUserWallets = await prisma.userWallet.deleteMany({});
  console.log(`  Deleted ${deletedUserWallets.count} user wallets`);

  // ============================================
  // Step 2: Derive addresses from private keys
  // ============================================
  console.log('\nStep 2: Deriving addresses from private keys...');

  // EVM
  const evmAddress = deriveEvmAddress(PLATFORM_KEYS.evm);
  console.log(`  EVM hot/funding: ${evmAddress}`);

  // Solana
  const solResult = deriveSolanaAddress(PLATFORM_KEYS.sol);
  console.log(`  SOL hot/funding: ${solResult.address}`);

  // Tron
  const trcAddress = deriveTronAddress(PLATFORM_KEYS.trc);
  console.log(`  TRC hot/funding: ${trcAddress}`);

  // User wallets
  const userEvmAddress = deriveEvmAddress(USER_WALLET_KEYS.evm);
  const userSolResult = deriveSolanaAddress(USER_WALLET_KEYS.sol);
  const userTrcAddress = deriveTronAddress(USER_WALLET_KEYS.trc);

  console.log(`\n  User EVM: ${userEvmAddress}`);
  console.log(`  User SOL: ${userSolResult.address}`);
  console.log(`  User TRC: ${userTrcAddress}`);

  // ============================================
  // Step 3: Encrypt with KMS and save platform keys
  // ============================================
  console.log('\nStep 3: Encrypting and saving platform keys...');

  // EVM keys (hot = funding, same key)
  const evmEncrypted = await encryptWithKms(
    PLATFORM_KEYS.evm.startsWith('0x') ? PLATFORM_KEYS.evm : `0x${PLATFORM_KEYS.evm}`
  );

  await prisma.platformKey.createMany({
    data: [
      { chain: 'evm', walletType: 'hot', publicAddress: evmAddress, encryptedPrivateKey: evmEncrypted },
      { chain: 'evm', walletType: 'funding', publicAddress: evmAddress, encryptedPrivateKey: evmEncrypted },
      { chain: 'evm', walletType: 'cold', publicAddress: COLD_ADDRESSES.evm, encryptedPrivateKey: null },
    ],
  });
  console.log('  EVM: hot, funding, cold saved');

  // SOL keys (hot = funding, same key) - store as base64
  const solEncrypted = await encryptWithKms(solResult.base64Key);

  await prisma.platformKey.createMany({
    data: [
      { chain: 'sol', walletType: 'hot', publicAddress: solResult.address, encryptedPrivateKey: solEncrypted },
      { chain: 'sol', walletType: 'funding', publicAddress: solResult.address, encryptedPrivateKey: solEncrypted },
      { chain: 'sol', walletType: 'cold', publicAddress: COLD_ADDRESSES.sol, encryptedPrivateKey: null },
    ],
  });
  console.log('  SOL: hot, funding, cold saved');

  // TRC keys (hot = funding, same key)
  const trcEncrypted = await encryptWithKms(PLATFORM_KEYS.trc);

  await prisma.platformKey.createMany({
    data: [
      { chain: 'trc', walletType: 'hot', publicAddress: trcAddress, encryptedPrivateKey: trcEncrypted },
      { chain: 'trc', walletType: 'funding', publicAddress: trcAddress, encryptedPrivateKey: trcEncrypted },
      { chain: 'trc', walletType: 'cold', publicAddress: COLD_ADDRESSES.trc, encryptedPrivateKey: null },
    ],
  });
  console.log('  TRC: hot, funding, cold saved');

  // ============================================
  // Step 4: Encrypt and save user wallets
  // ============================================
  console.log('\nStep 4: Encrypting and saving user wallets...');

  // User EVM wallet
  const userEvmEncrypted = await encryptWithKms(
    USER_WALLET_KEYS.evm.startsWith('0x') ? USER_WALLET_KEYS.evm : `0x${USER_WALLET_KEYS.evm}`
  );
  await prisma.userWallet.create({
    data: {
      userId: TEST_USER_ID,
      chain: 'evm',
      depositAddress: userEvmAddress,
      encryptedPrivateKey: userEvmEncrypted,
      publicKey: null,
    },
  });
  console.log(`  EVM user wallet saved: ${userEvmAddress}`);

  // User SOL wallet (store as base64)
  const userSolEncrypted = await encryptWithKms(userSolResult.base64Key);
  await prisma.userWallet.create({
    data: {
      userId: TEST_USER_ID,
      chain: 'sol',
      depositAddress: userSolResult.address,
      encryptedPrivateKey: userSolEncrypted,
      publicKey: userSolResult.address,
    },
  });
  console.log(`  SOL user wallet saved: ${userSolResult.address}`);

  // User TRC wallet
  const userTrcEncrypted = await encryptWithKms(USER_WALLET_KEYS.trc);
  await prisma.userWallet.create({
    data: {
      userId: TEST_USER_ID,
      chain: 'trc',
      depositAddress: userTrcAddress,
      encryptedPrivateKey: userTrcEncrypted,
      publicKey: null,
    },
  });
  console.log(`  TRC user wallet saved: ${userTrcAddress}`);

  // ============================================
  // Step 5: Verify
  // ============================================
  console.log('\nStep 5: Verifying saved data...');

  const platformKeys = await prisma.platformKey.findMany({
    orderBy: [{ chain: 'asc' }, { walletType: 'asc' }],
  });
  console.log(`\nPlatform keys (${platformKeys.length} records):`);
  for (const key of platformKeys) {
    const hasKey = key.encryptedPrivateKey ? 'KMS-encrypted' : 'no key';
    const prefix = key.encryptedPrivateKey?.slice(0, 8) || '-';
    console.log(`  ${key.chain}/${key.walletType}: ${key.publicAddress} (${hasKey}, prefix: ${prefix})`);
  }

  const userWallets = await prisma.userWallet.findMany({
    orderBy: { chain: 'asc' },
  });
  console.log(`\nUser wallets (${userWallets.length} records):`);
  for (const wallet of userWallets) {
    const prefix = wallet.encryptedPrivateKey.slice(0, 8);
    console.log(`  ${wallet.chain}: ${wallet.depositAddress} (prefix: ${prefix})`);
  }

  console.log('\n=== All keys reset and encrypted with KMS successfully! ===');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
