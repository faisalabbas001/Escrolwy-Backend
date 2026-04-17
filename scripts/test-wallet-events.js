/**
 * Test Script: Wallet Service Events
 *
 * Publishes test events to Kafka for wallet service consumers:
 * - auth.user.created (UserCreatedConsumer)
 * - ledger.external_payout_created (WithdrawalRequestedConsumer)
 *
 * Usage:
 *   node scripts/test-wallet-events.js userCreated [userId] [email]
 *   node scripts/test-wallet-events.js withdrawalRequested [transferId] [userId] [asset] [amount] [chain] [destinationAddress]
 *
 * Prerequisites:
 * - Kafka running (docker-compose)
 * - Wallet service running to consume events
 *
 * Examples:
 *   node scripts/test-wallet-events.js userCreated
 *   node scripts/test-wallet-events.js userCreated 550e8400-e29b-41d4-a716-446655440000 test@example.com
 *   node scripts/test-wallet-events.js withdrawalRequested
 *   node scripts/test-wallet-events.js withdrawalRequested transfer-123 550e8400-e29b-41d4-a716-446655440000 USDT 100.5 eth 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
 *
 * Note: userId must be a valid UUID format (e.g., 550e8400-e29b-41d4-a716-446655440000)
 */

const { Kafka } = require('kafkajs');
const { randomUUID } = require('crypto');

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const CLIENT_ID = 'wallet-event-test-script';

// Initialize Kafka
const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: KAFKA_BROKERS.split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  idempotent: true,
  maxInFlightRequests: 5,
});

/**
 * Create event metadata
 */
function createMetadata(topic, correlationId) {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    eventType: topic,
    source: CLIENT_ID,
    version: '1.0.0',
    correlationId: correlationId || randomUUID(),
  };
}

/**
 * Create BaseEvent structure
 */
function createEvent(topic, payload, correlationId) {
  const metadata = createMetadata(topic, correlationId);
  return {
    metadata,
    payload,
  };
}

/**
 * Publish userCreated event
 */
async function publishUserCreated(userId, email) {
  const topic = 'auth.user.created';

  // Default values if not provided
  // Note: userId must be a valid UUID format as the database expects @db.Uuid
  const finalUserId = userId || randomUUID();
  const finalEmail = email || `test-${Date.now()}@example.com`;

  const payload = {
    userId: finalUserId,
    email: finalEmail,
    role: 'user',
    displayName: `Test User ${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const event = createEvent(topic, payload);

  console.log('\n📤 Publishing userCreated event...');
  console.log('   Topic:', topic);
  console.log('   Event ID:', event.metadata.eventId);
  console.log('   Payload:', JSON.stringify(payload, null, 2));

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: finalUserId, // Partition key
          value: JSON.stringify(event),
          headers: {
            eventId: event.metadata.eventId,
            eventType: topic,
            source: CLIENT_ID,
          },
        },
      ],
    });

    console.log('✅ Event published successfully!');
    console.log('   User ID:', finalUserId);
    console.log('   Email:', finalEmail);
    console.log(
      '\n💡 Check wallet service logs to see if the event was consumed.'
    );
    return event.metadata.eventId;
  } catch (error) {
    console.error('❌ Failed to publish event:', error.message);
    throw error;
  }
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Publish withdrawalRequested event
 */
async function publishWithdrawalRequested(
  transferId,
  userId,
  asset,
  amount,
  chain,
  destinationAddress
) {
  const topic = 'ledger.external_payout_created';

  // Default values if not provided
  // Note: senderId (userId) must be a valid UUID format as the database expects @db.Uuid
  const finalTransferId = transferId || `transfer-${Date.now()}`;
  let finalUserId = userId || randomUUID();

  // Validate UUID format - if provided userId is not a valid UUID, generate a new one
  if (userId && !isValidUUID(userId)) {
    console.warn(
      `⚠️  Warning: "${userId}" is not a valid UUID format. Generating a new UUID instead.`
    );
    finalUserId = randomUUID();
  }
  const finalAsset = asset || 'USDT';
  const finalAmount = amount || '100.5';
  const finalChain = chain || 'eth';
  const finalDestinationAddress =
    destinationAddress || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

  const payload = {
    transferId: finalTransferId,
    asset: finalAsset,
    amount: finalAmount, // String as expected by consumer
    chain: finalChain,
    senderId: finalUserId,
    destinationAddress: finalDestinationAddress,
    destinationChain: finalChain,
    createdAt: new Date().toISOString(),
  };

  const event = createEvent(topic, payload);

  console.log('\n📤 Publishing withdrawalRequested event...');
  console.log('   Topic:', topic);
  console.log('   Event ID:', event.metadata.eventId);
  console.log('   Payload:', JSON.stringify(payload, null, 2));

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: finalTransferId, // Partition key
          value: JSON.stringify(event),
          headers: {
            eventId: event.metadata.eventId,
            eventType: topic,
            source: CLIENT_ID,
          },
        },
      ],
    });

    console.log('✅ Event published successfully!');
    console.log('   Transfer ID:', finalTransferId);
    console.log('   User ID:', finalUserId);
    console.log('   Asset:', finalAsset);
    console.log('   Amount:', finalAmount);
    console.log('   Chain:', finalChain);
    console.log('   Destination:', finalDestinationAddress);
    console.log(
      '\n💡 Check wallet service logs to see if the event was consumed.'
    );
    return event.metadata.eventId;
  } catch (error) {
    console.error('❌ Failed to publish event:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const eventType = args[0];

  if (!eventType) {
    console.error('❌ Error: Event type required');
    console.log('\nUsage:');
    console.log(
      '  node scripts/test-wallet-events.js userCreated [userId] [email]'
    );
    console.log(
      '  node scripts/test-wallet-events.js withdrawalRequested [transferId] [userId] [asset] [amount] [chain] [destinationAddress]'
    );
    console.log('\nExamples:');
    console.log('  node scripts/test-wallet-events.js userCreated');
    console.log(
      '  node scripts/test-wallet-events.js userCreated 550e8400-e29b-41d4-a716-446655440000 test@example.com'
    );
    console.log('  node scripts/test-wallet-events.js withdrawalRequested');
    console.log(
      '  node scripts/test-wallet-events.js withdrawalRequested transfer-123 550e8400-e29b-41d4-a716-446655440000 USDT 100.5 eth 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
    );
    console.log(
      '\nNote: userId must be a valid UUID format. If not provided or invalid, a UUID will be generated automatically.'
    );
    process.exit(1);
  }

  try {
    // Connect to Kafka
    console.log('🔌 Connecting to Kafka...');
    console.log('   Brokers:', KAFKA_BROKERS);
    await producer.connect();
    console.log('✅ Connected to Kafka\n');

    // Publish the requested event
    if (eventType === 'userCreated') {
      const userId = args[1];
      const email = args[2];
      await publishUserCreated(userId, email);
    } else if (eventType === 'withdrawalRequested') {
      const transferId = args[1];
      const userId = args[2];
      const asset = args[3];
      const amount = args[4];
      const chain = args[5];
      const destinationAddress = args[6];
      await publishWithdrawalRequested(
        transferId,
        userId,
        asset,
        amount,
        chain,
        destinationAddress
      );
    } else {
      console.error(`❌ Unknown event type: ${eventType}`);
      console.log('   Supported types: userCreated, withdrawalRequested');
      process.exit(1);
    }

    // Disconnect
    await producer.disconnect();
    console.log('\n🔌 Disconnected from Kafka');
    console.log('🏁 Done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    try {
      await producer.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
