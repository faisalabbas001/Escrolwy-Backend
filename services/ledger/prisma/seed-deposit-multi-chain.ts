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
 * Multi-Chain Deposit Seed Script
 * 
 * Publishes user.deposit events for a single user across all chain/currency combinations.
 * This creates 15 different accounts (5 chains × 3 currencies) for one user.
 * 
 * Chains: poly, trc, bnb, sol, trc (Note: trc appears twice, using poly, trc, bnb, sol, eth)
 * Currencies: USDT, USDC, DAI
 * 
 * Total: 5 chains × 3 currencies = 15 accounts
 * 
 * Each deposit will create:
 * - A user account (ownerType=user, purpose=spendable) for the specific chain/currency
 * - A journal entry with type=deposit
 * - A transfer FROM platform TO user
 */

// Single user ID (you can change this to any user ID)
const USER_ID = 'f9adc96e-ed59-47ad-ad53-4dfc04043b42';

// Chains to seed (5 chains: poly, trc (Tron), bnb, sol, eth)
const CHAINS = ['poly', 'trc', 'bnb', 'sol', 'eth'] as const;

// Currencies to seed (3 currencies)
const CURRENCIES = ['USDT', 'USDC', 'DAI'] as const;

// Deposit amount per account (you can customize this)
const DEPOSIT_AMOUNT = 1000;

/**
 * Create a user.deposit event payload for a specific chain and currency
 * 
 * This event will trigger UserDepositHandler, which creates a transfer
 * FROM platform TO the user, crediting the user's account.
 */
function createUserDepositPayload(
  userId: string,
  amount: number,
  asset: string,
  chain: string,
): UserDepositPayload {
  return {
    userId,
    amount,
    asset,
    chain,
    transactionHash: `seed-deposit-${userId}-${chain}-${asset}-${uuidv4()}`, // Unique idempotency key
  };
}

async function main() {
  console.log('🌱 Starting Multi-Chain Deposit Seed Script...');
  console.log('📡 Publishing user.deposit events for single user across all chain/currency combinations...\n');
  console.log(`👤 User ID: ${USER_ID}`);
  console.log(`🔗 Chains: ${CHAINS.join(', ')}`);
  console.log(`💰 Currencies: ${CURRENCIES.join(', ')}`);
  console.log(`💵 Deposit amount per account: ${DEPOSIT_AMOUNT}`);
  console.log(`📊 Total accounts to create: ${CHAINS.length * CURRENCIES.length}\n`);

  // Read Kafka configuration from environment
  const brokersStr = process.env.KAFKA_BROKERS || 'localhost:19092';
  const brokersArray = brokersStr
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (b.includes(':') ? b : `${b}:9092`));
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
    clientId: 'ledger-multi-chain-deposit-script',
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

  // Generate events for all chain/currency combinations
  const events: Array<{ topic: string; payload: UserDepositPayload; key: string }> = [];

  for (const chain of CHAINS) {
    for (const currency of CURRENCIES) {
      const payload = createUserDepositPayload(USER_ID, DEPOSIT_AMOUNT, currency, chain);
      const accountKey = `${chain}-${currency}`;
      
      events.push({
        topic: 'user.deposit',
        payload,
        key: `${USER_ID}-${accountKey}`, // Partition by userId-account for ordering
      });

      console.log(`📤 Prepared deposit: ${currency} on ${chain} → ${DEPOSIT_AMOUNT} ${currency}`);
    }
  }

  console.log(`\n🚀 Publishing ${events.length} events to Kafka...\n`);

  // Publish events with a small delay between each to avoid overwhelming the system
  const publishedEventIds: string[] = [];
  const failedEvents: Array<{ payload: UserDepositPayload; error: any }> = [];

  for (const { topic, payload, key } of events) {
    try {
      const eventId = await producer.produce(
        topic,
        payload,
        key,
        `seed-multi-chain-${payload.userId}`, // Correlation ID
      );
      publishedEventIds.push(eventId);
      console.log(`✅ Published: ${payload.asset} on ${payload.chain} (eventId: ${eventId})`);
      
      // Small delay to avoid overwhelming Kafka
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Failed to publish deposit for ${payload.asset} on ${payload.chain}:`, error);
      failedEvents.push({ payload, error });
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total events prepared: ${events.length}`);
  console.log(`   Events published successfully: ${publishedEventIds.length}`);
  console.log(`   Events failed: ${failedEvents.length}`);
  
  if (failedEvents.length > 0) {
    console.log(`\n❌ Failed events:`);
    failedEvents.forEach(({ payload, error }) => {
      console.log(`   - ${payload.asset} on ${payload.chain}: ${error.message || error}`);
    });
  }

  console.log(`\n📋 Account breakdown:`);
  console.log(`   User: ${USER_ID}`);
  for (const chain of CHAINS) {
    console.log(`   ${chain.toUpperCase()}:`);
    for (const currency of CURRENCIES) {
      console.log(`     - ${currency} (spendable account)`);
    }
  }

  console.log(`\n⏳ Waiting for ledger service to consume events and create accounts...`);
  console.log(`   Make sure the ledger service is running and consuming from Kafka.`);
  console.log(`\n💡 Note: user.deposit events create transfers FROM platform TO users.`);
  console.log(`   This will credit user accounts and debit platform custody pool.`);
  console.log(`   Platform custody pool may have negative balance initially (acceptable for seeding).`);
  console.log(`\n📝 Each deposit creates:`);
  console.log(`   - User account: ownerType=user, purpose=spendable, asset=<currency>, chain=<chain>`);
  console.log(`   - Journal entry: type=deposit`);
  console.log(`   - Transfer: FROM platform TO user`);

  // Give some time for events to be published
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await producer.disconnect();
  console.log('\n✅ Multi-chain deposit seed script completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error in seed script:', e);
    process.exit(1);
  });

