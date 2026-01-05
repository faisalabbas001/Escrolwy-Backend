const { createCipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

// Load .env file manually
const envPath = path.join(__dirname, '../services/wallet/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
});

const scryptAsync = promisify(scrypt);
const algorithm = 'aes-256-gcm';
const ivLength = 16;
const saltLength = 32;
const tagLength = 16;

async function encryptSolanaKey(privateKeyBase58, encryptionKey) {
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

async function main() {
  const privateKey = process.argv[2];
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;

  if (!privateKey) {
    console.error('Usage: node encrypt-solana-key.js <base58_private_key>');
    process.exit(1);
  }

  if (!encryptionKey) {
    console.error('Error: WALLET_ENCRYPTION_KEY not found in .env file');
    process.exit(1);
  }

  try {
    console.log('🔐 Encrypting Solana private key...');
    console.log('   Converting base58 to secretKey format...');
    const encrypted = await encryptSolanaKey(privateKey, encryptionKey);
    console.log('\n✅ Encrypted key (ready for .env):');
    console.log(encrypted);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

