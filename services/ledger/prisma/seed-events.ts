import {
  KafkaProducer,
  ProducerConfig,
} from '@escrowly/kafka-core';
import { v4 as uuidv4 } from 'uuid';

/**
 * User Deposit Payload
 * 
 * Payload for user deposit events that credit user accounts from platform custody pool
 */
interface UserDepositPayload {
  userId: string;
  amount: number;
  asset: string;
  chain: string;
  transactionHash?: string;
  depositId?: string; // Optional idempotency key
}

/**
 * Ledger Service Event-Based Seed Script
 * 
 * Publishes Kafka events that the ledger service will consume to create accounts and initial balances.
 * This approach tests the event-driven architecture end-to-end.
 * 
 * User Accounts (spendable + reserved):
 * - buyer_1: spendable=150, reserved=0
 * - buyer_2: spendable=90, reserved=0
 * - seller_1: spendable=50, reserved=0
 * - seller_2: spendable=200, reserved=0
 * - broker_1: spendable=100, reserved=0
 * 
 * System Accounts:
 * - platform_revenue (ownerType=platform, purpose=fees)
 * - platform_custody_pool (ownerType=platform, purpose=treasury_hot)
 * - escrow_holding_pool (ownerType=platform, purpose=treasury_hot)
 * 
 * Asset/Chain: USDT/eth (default for testing)
 * 
 * Strategy:
 * We publish user.deposit events that create transfers FROM platform TO users.
 * The UserDepositHandler creates transfers FROM platform TO users, which credits user accounts.
 * 
 * IMPORTANT: The transfer service validates balance sufficiency. For this to work, you need to either:
 * 1. Seed platform custody pool balance first (using the direct seed.ts script), OR
 * 2. Modify the validator to allow negative balances for platform accounts during seeding
 * 
 * The platform custody pool will be debited, so it needs sufficient balance or the validator
 * needs to be adjusted to allow negative balances for platform accounts.
 */

// Fixed UUIDs matching Auth Service seed data
const USER_IDS = {
  BUYER_1: '11111111-1111-4111-8111-111111111111',
  BUYER_2: '22222222-2222-4222-8222-222222222222',
  SELLER_1: '33333333-3333-4333-8333-333333333333',
  SELLER_2: '44444444-4444-4444-8444-444444444444',
  BROKER_1: '55555555-5555-4555-8555-555555555555',
};

const ASSET = 'USDT';
const CHAIN = 'eth';

// User balances to seed
const USER_BALANCES = {
  [USER_IDS.BUYER_1]: 150,
  [USER_IDS.BUYER_2]: 90,
  [USER_IDS.SELLER_1]: 50,
  [USER_IDS.SELLER_2]: 200,
  [USER_IDS.BROKER_1]: 100,
};

/**
 * Create a user.deposit event payload for seeding
 * 
 * This event will trigger UserDepositHandler, which creates a transfer
 * FROM platform TO the user, crediting the user's account.
 */
function createUserDepositPayload(
  userId: string,
  amount: number,
): UserDepositPayload {
  return {
    userId,
    amount,
    asset: ASSET,
    chain: CHAIN,
    depositId: `seed-deposit-${userId}`, // Idempotency key
  };
}

async function main() {
  console.log('🌱 Starting Ledger Service Event-Based Seed Script...');
  console.log('📡 Publishing Kafka events that ledger service will consume...\n');

  // Read Kafka configuration from environment
  const brokersStr = process.env.KAFKA_BROKERS || 'localhost:19092';
  const brokersArray = brokersStr
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (b.includes(':') ? b : `${b}:29092`));
  const enabled = true;

  console.log(`[KafkaConfig] brokers = ${brokersArray.join(',')}`);
  console.log(`[KafkaConfig] enabled = ${enabled}\n`);

  if (!enabled) {
    console.warn('⚠️  Kafka is disabled. Events will not be published.');
    console.warn('   Set KAFKA_ENABLED=true to enable event publishing.');
    return;
  }

  // Create Kafka producer directly
  const producerConfig: ProducerConfig = {
    clientId: 'ledger-seed-script',
    brokers: brokersArray,
    ssl: process.env.KAFKA_SSL === 'true',
    sasl:
      process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD
        ? {
            mechanism: 'plain',
            username: process.env.KAFKA_USERNAME,
            password: process.env.KAFKA_PASSWORD,
          }
        : undefined,
  };

  const producer = new KafkaProducer(producerConfig);

  try {
    await producer.connect();
    console.log('✅ Kafka producer connected\n');
  } catch (error) {
    console.error('❌ Failed to connect to Kafka:', error);
    process.exit(1);
  }

  // Publish events for each user
  const events: Array<{ topic: string; payload: UserDepositPayload; key: string }> = [];

  for (const [userId, balance] of Object.entries(USER_BALANCES)) {
    const userName =
      Object.keys(USER_IDS).find((key) => USER_IDS[key as keyof typeof USER_IDS] === userId) ||
      userId;

    const payload = createUserDepositPayload(userId, balance);
    events.push({
      topic: 'user.deposit',
      payload,
      key: userId, // Partition by userId for ordering
    });

    console.log(`📤 Prepared deposit event for ${userName}: ${balance} ${ASSET}`);
  }

  console.log(`\n🚀 Publishing ${events.length} events to Kafka...\n`);

  // Publish events
  const publishedEventIds: string[] = [];
  for (const { topic, payload, key } of events) {
    try {
      // Producer expects just the payload, not the full BaseEvent
      // It will wrap it with metadata automatically
      const eventId = await producer.produce(
        topic,
        payload, // Pass the payload directly
        key,
        `seed-${payload.userId}`, // Correlation ID
      );
      publishedEventIds.push(eventId);
      console.log(`✅ Published deposit event ${eventId} to ${topic} (key: ${key})`);
    } catch (error) {
      console.error(`❌ Failed to publish deposit event for ${key}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Events prepared: ${events.length}`);
  console.log(`   Events published: ${publishedEventIds.length}`);
  console.log(`\n⏳ Waiting for ledger service to consume events and create accounts...`);
  console.log(`   Make sure the ledger service is running and consuming from Kafka.`);
  console.log(`\n💡 Note: user.deposit events create transfers FROM platform TO users.`);
  console.log(`   This will credit user accounts and debit platform custody pool.`);
  console.log(`   Platform custody pool may have negative balance initially (acceptable for seeding).`);

  // Give some time for events to be published
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await producer.disconnect();
  console.log('\n✅ Seed script completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error in seed script:', e);
    process.exit(1);
  });

