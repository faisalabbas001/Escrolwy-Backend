/**
 * Script to insert a test wallet into the user_wallets table
 * 
 * Usage: node scripts/insert-test-wallet.js [chain] [userId] [address] [privateKey]
 * 
 * Examples:
 *   # Solana wallet
 *   node scripts/insert-test-wallet.js sol 550e8400-e29b-41d4-a716-446655440000 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk 58cGdUyFymk5EZ4TQDNrpVhpb26xAiVBrkVon9XkfQ3Unk7eDJYHBrrjup6zbXF94syPQnsUCcQoKtLhoPvNSwTE
 * 
 *   # Tron wallet
 *   node scripts/insert-test-wallet.js trc 550e8400-e29b-41d4-a716-446655440000 TVox6sYqTDL2yXf2FbCpnvNPpT16ESWS7a 7c5e797c5c00e199ac60e03a567f6c94be9fb417f86856d7bbf81c56a29f2757
 */

const { createCipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../services/wallet/generated/prisma');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const scryptAsync = promisify(scrypt);

// Load .env file
const envPath = path.join(__dirname, '../services/wallet/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Initialize Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function encryptTronKey(privateKeyHex) {
  const algorithm = 'aes-256-gcm';
  const ivLength = 16;
  const saltLength = 32;
  
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not found in environment');
  }
  
  // Validate hex format (64 characters)
  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
    throw new Error(`Invalid Tron private key format: expected 64-character hex string, got ${privateKeyHex.length} characters`);
  }
  
  // Generate random salt and IV
  const salt = randomBytes(saltLength);
  const iv = randomBytes(ivLength);
  
  // Derive key from password using scrypt
  const key = await scryptAsync(encryptionKey, salt, 32);
  
  // Create cipher
  const cipher = createCipheriv(algorithm, key, iv);
  
  // Encrypt the hex private key (as UTF-8 string)
  const encrypted = Buffer.concat([
    cipher.update(privateKeyHex, 'utf8'),
    cipher.final(),
  ]);
  
  // Get auth tag
  const tag = cipher.getAuthTag();
  
  // Combine all parts: salt + iv + tag + encrypted
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  // Return as base64
  return combined.toString('base64');
}

async function encryptSolanaKey(privateKeyBase58) {
  const algorithm = 'aes-256-gcm';
  const ivLength = 16;
  const saltLength = 32;
  
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not found in environment');
  }
  
  // Convert base58 private key to secretKey format
  // Decode base58 - it might be 32 bytes (private key) or 64 bytes (full secretKey)
  const decodedBytes = bs58.decode(privateKeyBase58);
  
  let secretKey;
  if (decodedBytes.length === 32) {
    // It's just the private key, need to create full secretKey
    const keypair = Keypair.fromSecretKey(decodedBytes);
    secretKey = Buffer.from(keypair.secretKey);
  } else if (decodedBytes.length === 64) {
    // It's already the full secretKey
    secretKey = Buffer.from(decodedBytes);
  } else {
    throw new Error(`Invalid private key length: expected 32 or 64 bytes, got ${decodedBytes.length}`);
  }
  
  // Convert secretKey to base64 (this is what the wallet generator stores)
  const secretKeyBase64 = secretKey.toString('base64');
  
  // Generate random salt and IV
  const salt = randomBytes(saltLength);
  const iv = randomBytes(ivLength);
  
  // Derive key from password using scrypt
  const key = await scryptAsync(encryptionKey, salt, 32);
  
  // Create cipher
  const cipher = createCipheriv(algorithm, key, iv);
  
  // Encrypt the base64-encoded secretKey
  const encrypted = Buffer.concat([
    cipher.update(secretKeyBase64, 'utf8'),
    cipher.final(),
  ]);
  
  // Get auth tag
  const tag = cipher.getAuthTag();
  
  // Combine all parts: salt + iv + tag + encrypted
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  // Return as base64
  return combined.toString('base64');
}

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments: [chain] [userId] [address] [privateKey]
  const chain = args[0] || 'sol';
  let userId = args[1] || randomUUID();
  const address = args[2] || (chain === 'trc' ? 'TVox6sYqTDL2yXf2FbCpnvNPpT16ESWS7a' : '3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk');
  const privateKey = args[3] || (chain === 'trc' ? '7c5e797c5c00e199ac60e03a567f6c94be9fb417f86856d7bbf81c56a29f2757' : '58cGdUyFymk5EZ4TQDNrpVhpb26xAiVBrkVon9XkfQ3Unk7eDJYHBrrjup6zbXF94syPQnsUCcQoKtLhoPvNSwTE');
  
  // Validate chain
  if (!['sol', 'trc'].includes(chain)) {
    console.error(`❌ Error: Invalid chain "${chain}". Supported chains: sol, trc`);
    process.exit(1);
  }
  
  // Validate UUID
  if (!isValidUUID(userId)) {
    console.error(`❌ Error: "${userId}" is not a valid UUID format`);
    console.log('   Generating a new UUID instead...');
    userId = randomUUID();
  }
  
  try {
    console.log(`🔐 Encrypting ${chain.toUpperCase()} private key...`);
    let encryptedPrivateKey;
    
    if (chain === 'sol') {
      console.log('   Converting base58 private key to secretKey format...');
      encryptedPrivateKey = await encryptSolanaKey(privateKey);
    } else if (chain === 'trc') {
      console.log('   Encrypting hex private key...');
      encryptedPrivateKey = await encryptTronKey(privateKey);
    }
    
    console.log('💾 Inserting wallet into database...');
    console.log(`   Chain: ${chain}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Address: ${address}`);
    
    // Check if wallet already exists
    const existing = await prisma.userWallet.findFirst({
      where: {
        chain,
        depositAddress: address,
      },
    });
    
    if (existing) {
      console.log('⚠️  Wallet already exists in database!');
      console.log(`   Existing wallet ID: ${existing.id}`);
      console.log(`   User ID: ${existing.userId}`);
      console.log('   Updating with new encrypted key...');
      
      // Update the existing wallet with the correct encrypted key
      const wallet = await prisma.userWallet.update({
        where: { id: existing.id },
        data: {
          encryptedPrivateKey,
          publicKey: address, // For both Solana and Tron, address is the public key
        },
      });
      
      console.log('✅ Wallet updated successfully!');
      console.log(`   Wallet ID: ${wallet.id}`);
      console.log(`   User ID: ${wallet.userId}`);
      console.log(`   Chain: ${wallet.chain}`);
      console.log(`   Address: ${wallet.depositAddress}`);
      console.log(`   Updated at: ${wallet.updatedAt}`);
      
      await prisma.$disconnect();
      return;
    }
    
    // Insert the wallet
    const wallet = await prisma.userWallet.create({
      data: {
        userId,
        chain,
        depositAddress: address,
        encryptedPrivateKey,
        publicKey: address, // For both Solana and Tron, address is the public key
      },
    });
    
    console.log('✅ Wallet inserted successfully!');
    console.log(`   Wallet ID: ${wallet.id}`);
    console.log(`   User ID: ${wallet.userId}`);
    console.log(`   Chain: ${wallet.chain}`);
    console.log(`   Address: ${wallet.depositAddress}`);
    console.log(`   Created at: ${wallet.createdAt}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
