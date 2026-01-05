/**
 * Script to encrypt a private key using the same method as the wallet service
 * 
 * Usage: node scripts/encrypt-key.js <private-key>
 * 
 * Requires WALLET_ENCRYPTION_KEY to be set in the environment or .env file
 */

const { createCipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const scryptAsync = promisify(scrypt);

// Load .env file if it exists
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

async function encryptKey(privateKey) {
  const algorithm = 'aes-256-gcm';
  const ivLength = 16;
  const saltLength = 32;
  
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not found in environment. Please set it in services/wallet/.env');
  }
  
  // Generate random salt and IV
  const salt = randomBytes(saltLength);
  const iv = randomBytes(ivLength);
  
  // Derive key from password using scrypt
  const key = await scryptAsync(encryptionKey, salt, 32);
  
  // Create cipher
  const cipher = createCipheriv(algorithm, key, iv);
  
  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
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
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Private key required');
    console.log('\nUsage: node scripts/encrypt-key.js <private-key>');
    console.log('\nExample:');
    console.log('  node scripts/encrypt-key.js QU4uiRGSrbnVzbNQi2VRdcFEpFHc6HgFiE1PvVeYwWMpr4cPqfWGkNQvbA2UuwKp38CpPvSkx6dqWXtoBtLf2Ui');
    process.exit(1);
  }
  
  const privateKey = args[0];
  
  try {
    console.log('🔐 Encrypting private key...');
    const encrypted = await encryptKey(privateKey);
    console.log('\n✅ Encrypted key:');
    console.log(encrypted);
    console.log('\n💡 Add this to your .env file:');
    console.log(`SOL_FUNDING_WALLET_KEY=${encrypted}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

