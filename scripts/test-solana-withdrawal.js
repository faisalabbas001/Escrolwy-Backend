const { Kafka } = require('kafkajs');
const { randomUUID } = require('crypto');

// ==========================================
// KAFKA CONFIGURATION
// ==========================================
const kafka = new Kafka({
  clientId: 'test-solana-withdrawal-script',
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
 * Publish ledger.external_payout_created event for Solana withdrawal
 * 
 * @param {string} transferId - Transfer ID (can be any string, will be prefixed with 'transfer-')
 * @param {string} userId - User ID (must be valid UUID)
 * @param {string} asset - Token symbol (e.g., 'USDT', 'USDC')
 * @param {number} amount - Amount in token's smallest unit (e.g., 10000 = 0.01 USDT with 6 decimals)
 * @param {string} destinationAddress - Solana address to send to
 * @param {string} chain - Chain identifier (default: 'sol')
 */
async function publishWithdrawalRequested(
  transferId,
  userId,
  asset = 'USDT',
  amount = 10000,
  destinationAddress,
  chain = 'sol'
) {
  const topic = 'ledger.external_payout_created';

  // Validate and generate userId
  let finalUserId = userId || randomUUID();
  if (userId && !isValidUUID(userId)) {
    console.warn(`⚠️  Warning: "${userId}" is not a valid UUID format. Generating a new UUID instead.`);
    finalUserId = randomUUID();
  }

  // Generate transferId if not provided
  const finalTransferId = transferId || `transfer-${Date.now()}`;

  // Validate destination address
  if (!destinationAddress) {
    throw new Error('destinationAddress is required');
  }

  // Create the event payload
  const payload = {
    transferId: finalTransferId,
    asset,
    amount: typeof amount === 'string' ? parseFloat(amount) : amount,
    chain,
    senderId: finalUserId,
    destinationAddress,
    destinationChain: chain,
    createdAt: new Date().toISOString(),
  };

  // Wrap in event envelope - must match BaseEvent<T> structure
  const event = {
    metadata: {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: topic,
      source: 'test-solana-withdrawal-script',
      version: '1.0.0',
      correlationId: randomUUID(),
    },
    payload: payload,
  };

  console.log(`\n📨 Publishing ${topic}:`);
  console.log(`   Transfer ID: ${finalTransferId}`);
  console.log(`   User ID: ${finalUserId}`);
  console.log(`   Chain: ${chain}`);
  console.log(`   Asset: ${asset}`);
  console.log(`   Amount: ${payload.amount} (smallest units)`);
  console.log(`   Destination Address: ${destinationAddress}`);
  console.log(`   Created At: ${payload.createdAt}`);

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
    return { transferId: finalTransferId, userId: finalUserId };
  } catch (error) {
    console.error(`❌ Failed to publish event:`, error.message);
    throw error;
  }
}

// ==========================================
// MAIN FUNCTION
// ==========================================
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🧪 Solana Withdrawal Event Test Script

Usage:
  node test-solana-withdrawal.js [options]

Options:
  --userId <uuid>              User ID (must be valid UUID)
  --transferId <id>            Transfer ID (optional, auto-generated if not provided)
  --asset <symbol>             Token symbol (default: USDT)
  --amount <number>            Amount in smallest units (default: 10000)
                              For USDT/USDC with 6 decimals: 10000 = 0.01 tokens
  --destination <address>      Solana destination address (required)
  --chain <chain>              Chain identifier (default: sol)

Examples:
  # Withdraw USDT to a Solana address
  node test-solana-withdrawal.js \\
    --userId 1ea94c57-7190-4b51-9d5e-8d3d47429d90 \\
    --asset USDT \\
    --amount 10000 \\
    --destination 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk

  # Withdraw USDC with custom transfer ID
  node test-solana-withdrawal.js \\
    --userId 1ea94c57-7190-4b51-9d5e-8d3d47429d90 \\
    --transferId my-custom-transfer-123 \\
    --asset USDC \\
    --amount 5000 \\
    --destination 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk

  # Withdraw with explicit chain (default is sol)
  node test-solana-withdrawal.js \\
    --userId 1ea94c57-7190-4b51-9d5e-8d3d47429d90 \\
    --asset USDT \\
    --amount 10000 \\
    --destination 3QpaSDgUTfbNLdjfRPR64oSDixmEqBDDKNeY3RBKpoYk \\
    --chain sol

Notes:
  - All IDs (userId) must be valid UUIDs
  - Amount is in token's smallest unit (not human-readable)
  - For USDT/USDC on Solana: 6 decimals, so 10000 = 0.01 tokens
  - Chain should be 'sol' for Solana (not 'sol-devnet')
  - The wallet service will execute the withdrawal from the hot wallet
    `);
    process.exit(0);
  }

  // Parse arguments
  const options = {
    userId: null,
    transferId: null,
    asset: 'USDT',
    amount: 10000,
    destination: null,
    chain: 'sol',
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    if (options.hasOwnProperty(key)) {
      options[key] = value;
    }
  }

  // Validate required fields
  if (!options.destination) {
    console.error('❌ Error: --destination is required');
    console.log('   Use --help for usage information');
    process.exit(1);
  }

  try {
    await producer.connect();
    console.log('✅ Connected to Kafka');

    await publishWithdrawalRequested(
      options.transferId,
      options.userId,
      options.asset,
      parseFloat(options.amount),
      options.destination,
      options.chain
    );

    await producer.disconnect();
    console.log('✅ Disconnected from Kafka\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

