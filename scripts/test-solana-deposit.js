const { Kafka } = require('kafkajs');
const { randomUUID } = require('crypto');

// ==========================================
// KAFKA CONFIGURATION
// ==========================================
const kafka = new Kafka({
  clientId: 'test-solana-deposit-script',
  brokers: ['localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 3,
  },
});

const producer = kafka.producer();

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Publish wallet.deposit.detected event
 * 
 * @param {string} userId - User ID (must be valid UUID)
 * @param {string} depositAddress - Solana deposit address
 * @param {string} asset - Token symbol (e.g., 'USDT', 'USDC', 'SOL')
 * @param {string} amount - Amount in token's smallest unit or human-readable format
 * @param {string} txHash - Transaction hash/signature
 * @param {number} blockNumber - Block number (slot number for Solana)
 */
async function publishDepositDetected(
  userId,
  depositAddress,
  asset = 'USDT',
  amount = '10000',
  txHash = null,
  blockNumber = null
) {
  const topic = 'wallet.deposit.detected';

  // Validate and generate userId
  let finalUserId = userId || randomUUID();
  if (userId && !isValidUUID(userId)) {
    console.warn(`⚠️  Warning: "${userId}" is not a valid UUID format. Generating a new UUID instead.`);
    finalUserId = randomUUID();
  }

  // Generate depositId
  const depositId = randomUUID();

  // Generate fake transaction details if not provided
  const finalTxHash = txHash || generateSolanaSignature();
  const finalBlockNumber = blockNumber || Math.floor(Date.now() / 1000); // Use timestamp as block number for testing

  // Create the event payload
  const payload = {
    userId: finalUserId,
    depositId,
    chain: 'sol', // Using sol for Solana
    asset,
    amount,
    txHash: finalTxHash,
    blockNumber: finalBlockNumber,
    depositAddress,
    detectedAt: new Date().toISOString(),
  };

  // Wrap in event envelope - must match BaseEvent<T> structure
  const event = {
    metadata: {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: topic,
      source: 'test-solana-deposit-script',
      version: '1.0.0',
      correlationId: randomUUID(),
    },
    payload: payload,
  };

  console.log(`\n📨 Publishing ${topic}:`);
  console.log(`   Deposit ID: ${depositId}`);
  console.log(`   User ID: ${finalUserId}`);
  console.log(`   Chain: sol`);
  console.log(`   Asset: ${asset}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Deposit Address: ${depositAddress}`);
  console.log(`   TX Hash: ${finalTxHash}`);
  console.log(`   Block Number: ${finalBlockNumber}`);

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: finalUserId, // Partition by userId for ordering
          value: JSON.stringify(event),
          headers: {
            eventType: topic,
            eventId: event.metadata.eventId,
            source: event.metadata.source,
          },
        },
      ],
    });
    console.log(`✅ Event published successfully!\n`);
    return { depositId, userId: finalUserId, txHash: finalTxHash };
  } catch (error) {
    console.error(`❌ Failed to publish event:`, error.message);
    throw error;
  }
}

/**
 * Publish wallet.deposit.confirmed event
 */
async function publishDepositConfirmed(
  userId,
  depositId,
  depositAddress,
  asset = 'USDT',
  amount = '10000',
  txHash = null,
  blockNumber = null
) {
  const topic = 'wallet.deposit.confirmed';

  // Validate userId
  let finalUserId = userId;
  if (!isValidUUID(userId)) {
    console.error(`❌ Error: "${userId}" is not a valid UUID format.`);
    process.exit(1);
  }

  // Generate fake transaction details if not provided
  const finalTxHash = txHash || generateSolanaSignature();
  const finalBlockNumber = blockNumber || Math.floor(Date.now() / 1000);

  const payload = {
    userId: finalUserId,
    depositId,
    chain: 'sol',
    asset,
    amount,
    txHash: finalTxHash,
    blockNumber: finalBlockNumber,
    depositAddress,
    confirmedAt: new Date().toISOString(),
  };

  // Wrap in event envelope - must match BaseEvent<T> structure
  const event = {
    metadata: {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: topic,
      source: 'test-solana-deposit-script',
      version: '1.0.0',
      correlationId: randomUUID(),
    },
    payload: payload,
  };

  console.log(`\n📨 Publishing ${topic}:`);
  console.log(`   Deposit ID: ${depositId}`);
  console.log(`   User ID: ${finalUserId}`);
  console.log(`   Chain: sol`);
  console.log(`   Asset: ${asset}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   TX Hash: ${finalTxHash}`);

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: finalUserId,
          value: JSON.stringify(event),
          headers: {
            eventType: topic,
            eventId: event.metadata.eventId,
            source: event.metadata.source,
          },
        },
      ],
    });
    console.log(`✅ Event published successfully!\n`);
  } catch (error) {
    console.error(`❌ Failed to publish event:`, error.message);
    throw error;
  }
}

/**
 * Generate a fake Solana transaction signature for testing
 */
function generateSolanaSignature() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let signature = '';
  for (let i = 0; i < 88; i++) {
    signature += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return signature;
}

// ==========================================
// MAIN FUNCTION
// ==========================================
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🧪 Solana Deposit Event Test Script

Usage:
  node test-solana-deposit.js <event-type> [options]

Event Types:
  detected    - Publish wallet.deposit.detected event
  confirmed   - Publish wallet.deposit.confirmed event

Options:
  --userId <uuid>           User ID (must be valid UUID)
  --depositId <uuid>        Deposit ID (required for 'confirmed' event)
  --address <address>       Solana deposit address (default: 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk)
  --asset <symbol>          Token symbol (default: USDT)
  --amount <amount>         Amount in smallest units (default: 10000)
  --txHash <hash>           Transaction signature (auto-generated if not provided)
  --blockNumber <number>    Block number/slot (auto-generated if not provided)

Examples:
  # Publish deposit detected event with specific userId
  node test-solana-deposit.js detected --userId 1ea94c57-7190-4b51-9d5e-8d3d47429d90 --address 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk --amount 10000

  # Publish deposit detected with custom token
  node test-solana-deposit.js detected --userId 1ea94c57-7190-4b51-9d5e-8d3d47429d90 --address 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk --asset USDC --amount 5000

  # Publish deposit confirmed event
  node test-solana-deposit.js confirmed --userId 1ea94c57-7190-4b51-9d5e-8d3d47429d90 --depositId <deposit-id> --address 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk --amount 10000

Notes:
  - All IDs (userId, depositId) must be valid UUIDs
  - Chain should be 'sol' for Solana
  - Amounts are in token's smallest unit (e.g., for USDT with 6 decimals, 10000 = 0.01 USDT)
    `);
    process.exit(0);
  }

  const eventType = args[0];

  // Parse arguments
  const options = {
    userId: null,
    depositId: null,
    address: '3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk',
    asset: 'USDT',
    amount: '10000',
    txHash: null,
    blockNumber: null,
  };

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    if (options.hasOwnProperty(key)) {
      options[key] = value;
    }
  }

  try {
    await producer.connect();
    console.log('✅ Connected to Kafka');

    if (eventType === 'detected') {
      const result = await publishDepositDetected(
        options.userId,
        options.address,
        options.asset,
        options.amount,
        options.txHash,
        options.blockNumber ? parseInt(options.blockNumber) : null
      );
      console.log('💡 Tip: Use this depositId for the "confirmed" event:');
      console.log(`   ${result.depositId}\n`);
    } else if (eventType === 'confirmed') {
      if (!options.depositId) {
        console.error('❌ Error: --depositId is required for "confirmed" event');
        process.exit(1);
      }
      if (!options.userId) {
        console.error('❌ Error: --userId is required for "confirmed" event');
        process.exit(1);
      }
      await publishDepositConfirmed(
        options.userId,
        options.depositId,
        options.address,
        options.asset,
        options.amount,
        options.txHash,
        options.blockNumber ? parseInt(options.blockNumber) : null
      );
    } else {
      console.error(`❌ Unknown event type: ${eventType}`);
      console.log('   Use "detected" or "confirmed"');
      process.exit(1);
    }

    await producer.disconnect();
    console.log('✅ Disconnected from Kafka\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

