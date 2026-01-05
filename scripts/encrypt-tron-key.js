const { createCipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const scryptAsync = promisify(scrypt);
const algorithm = 'aes-256-gcm';
const ivLength = 16;
const saltLength = 32;
const tagLength = 16;

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

async function encryptTronKey(privateKeyHex, encryptionKey) {
  // Tron private keys are hex strings (64 characters)
  // Validate it's a valid hex string
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

async function main() {
  const privateKey = process.argv[2];
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;

  if (!privateKey) {
    console.error('Usage: node encrypt-tron-key.js <hex_private_key>');
    process.exit(1);
  }

  if (!encryptionKey) {
    console.error('Error: WALLET_ENCRYPTION_KEY not found in .env file');
    process.exit(1);
  }

  try {
    console.log('🔐 Encrypting Tron private key...');
    console.log('   Private key (hex):', privateKey);
    const encrypted = await encryptTronKey(privateKey, encryptionKey);
    console.log('\n✅ Encrypted key (ready for .env):');
    console.log(encrypted);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);



