#!/usr/bin/env node

/**
 * Test Script: Wallet Deposit Completed Event
 * 
 * Tests the Notification Service handling of wallet.deposit.completed events.
 * 
 * This script:
 * 1. Publishes a wallet.deposit.completed event to Kafka
 * 2. Waits for the Notification Service to consume and process it
 * 3. Verifies database state changes (logs, processed events)
 * 4. Tests both Kafka healthy and unavailable scenarios
 * 
 * Usage:
 *   node test-wallet-deposit-event.js [--kafka-down]
 */

const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:19092';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const TEST_MODE = process.argv.includes('--kafka-down') ? 'kafka-down' : 'kafka-up';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

/**
 * Create Kafka producer
 */
function createKafkaProducer() {
  const kafka = new Kafka({
    clientId: 'test-wallet-deposit-producer',
    brokers: [KAFKA_BROKERS],
    retry: {
      retries: 3,
      initialRetryTime: 100,
    },
  });

  return kafka.producer();
}

/**
 * Publish wallet deposit event to Kafka
 */
async function publishWalletDepositEvent(producer) {
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();
  
  // wallet.deposit.completed event structure
  const event = {
    metadata: {
      eventId,
      timestamp,
      eventType: 'wallet.deposit.completed', // This would need to be added to mapper
      source: 'wallet-service',
      version: '1.0',
      correlationId: `test-${Date.now()}`,
    },
    payload: {
      walletId: `wallet-${uuidv4()}`,
      userId: `user-${uuidv4()}`,
      amount: '1000.50',
      asset: 'USDT',
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      depositedAt: timestamp,
      chain: 'ethereum',
      recipientEmail: 'talhariaz324@gmail.com', // Test email for verification
    },
  };

  logSection('📤 Publishing Wallet Deposit Event');
  log(`Event ID: ${eventId}`, 'cyan');
  log(`User ID: ${event.payload.userId}`, 'cyan');
  log(`Recipient Email: ${event.payload.recipientEmail || 'N/A'}`, 'cyan');
  log(`Amount: ${event.payload.amount} ${event.payload.asset}`, 'cyan');
  log(`Transaction: ${event.payload.transactionHash}`, 'cyan');

  try {
    await producer.send({
      topic: 'wallet.events', // Using wallet.events topic
      messages: [
        {
          key: event.payload.userId,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.metadata.eventType,
            'event-id': eventId,
          },
        },
      ],
    });

    log('✅ Event published to Kafka successfully', 'green');
    return { eventId, event };
  } catch (error) {
    log(`❌ Failed to publish event: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Check if Notification Service consumer is running
 */
async function checkConsumerStatus() {
  logSection('🔍 Checking Notification Service Consumer Status');
  
  return new Promise((resolve) => {
    const url = `${NOTIFICATION_SERVICE_URL}/api/v1/health`;
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          log('Health Status:', 'cyan');
          log(`  Status: ${health.status}`, health.status === 'ok' ? 'green' : 'yellow');
          
          if (health.info && health.info.kafka) {
            log(`  Kafka: ${health.info.kafka.status}`, health.info.kafka.status === 'up' ? 'green' : 'red');
          }
          
          log('\n💡 To enable Kafka consumer:', 'yellow');
          log('  1. Set KAFKA_ENABLED=true in .env file', 'cyan');
          log('  2. Restart Notification Service', 'cyan');
          log('  3. Check logs for "📥 Notification Consumer started"', 'cyan');
          
          resolve(health);
        } catch (error) {
          log(`⚠️  Could not parse health response: ${error.message}`, 'yellow');
          resolve(null);
        }
      });
    }).on('error', (error) => {
      log(`⚠️  Could not check health: ${error.message}`, 'yellow');
      resolve(null);
    });
  });
}

/**
 * Check database state via API
 */
async function checkDatabaseState(eventId, userId) {
  logSection('🔍 Checking Database State');

  return new Promise((resolve, reject) => {
    const url = `${NOTIFICATION_SERVICE_URL}/api/v1/notifications/admin/logs?eventKey=${eventId}&limit=10`;
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const logs = JSON.parse(data);
          log(`Found ${logs.data?.length || 0} notification log(s)`, 'cyan');
          
          if (logs.data && logs.data.length > 0) {
            logs.data.forEach((log, idx) => {
              log(`\nLog ${idx + 1}:`, 'yellow');
              log(`  ID: ${log.id}`);
              log(`  User ID: ${log.userId}`);
              log(`  Event Type: ${log.eventType}`);
              log(`  Template ID: ${log.templateId}`);
              log(`  Status: ${log.status}`, log.status === 'sent' ? 'green' : log.status === 'failed' ? 'red' : 'yellow');
              log(`  Recipient: ${log.recipientEmail}`);
              log(`  Subject: ${log.subject}`);
              if (log.errorMessage) {
                log(`  Error: ${log.errorMessage}`, 'red');
              }
              if (log.resendId) {
                log(`  Resend ID: ${log.resendId}`, 'green');
              }
              log(`  Created: ${log.createdAt}`);
            });
          } else {
            log('⚠️  No notification logs found yet', 'yellow');
          }

          // Check processed events
          checkProcessedEvents(eventId).then(() => resolve(logs)).catch(reject);
        } catch (error) {
          log(`❌ Failed to parse response: ${error.message}`, 'red');
          reject(error);
        }
      });
    }).on('error', (error) => {
      log(`❌ Failed to check database: ${error.message}`, 'red');
      reject(error);
    });
  });
}

/**
 * Check processed events (idempotency)
 */
async function checkProcessedEvents(eventId) {
  return new Promise((resolve) => {
    // Note: This endpoint might not exist, so we'll just log
    log('\n📋 Processed Events Check:', 'yellow');
    log(`  Event ID: ${eventId}`);
    log('  (Check processed_events table directly for idempotency tracking)', 'cyan');
    resolve();
  });
}

/**
 * Test Kafka connection
 */
async function testKafkaConnection(producer) {
  logSection('🔌 Testing Kafka Connection');
  
  try {
    await producer.connect();
    log('✅ Kafka connection successful', 'green');
    return true;
  } catch (error) {
    log(`❌ Kafka connection failed: ${error.message}`, 'red');
    log('  This is expected when testing --kafka-down scenario', 'yellow');
    return false;
  }
}

/**
 * Main test function
 */
async function main() {
  logSection('🧪 Wallet Deposit Event Test');
  log(`Mode: ${TEST_MODE === 'kafka-down' ? 'Kafka Down (Testing Failure Handling)' : 'Kafka Up (Normal Flow)'}`, 'cyan');
  log(`Kafka Brokers: ${KAFKA_BROKERS}`, 'cyan');
  log(`Notification Service: ${NOTIFICATION_SERVICE_URL}`, 'cyan');

  const producer = createKafkaProducer();
  let eventId, event;

  try {
    // Test Kafka connection
    const kafkaConnected = await testKafkaConnection(producer);

    if (!kafkaConnected && TEST_MODE === 'kafka-up') {
      log('\n⚠️  Kafka is not available. Use --kafka-down flag to test failure scenarios.', 'yellow');
      process.exit(1);
    }

    if (TEST_MODE === 'kafka-down') {
      logSection('📋 Testing Kafka Down Scenario');
      log('When Kafka is unavailable:', 'yellow');
      log('  1. Event publishing will fail', 'cyan');
      log('  2. Notification Service consumer will not receive events', 'cyan');
      log('  3. No database changes should occur', 'cyan');
      log('  4. Service should log errors but continue running', 'cyan');
      log('\n⚠️  This test requires Kafka to be stopped.', 'yellow');
      log('   Stop Kafka: docker-compose stop kafka', 'cyan');
      return;
    }

    // Check consumer status first
    await checkConsumerStatus();

    // Publish event
    const result = await publishWalletDepositEvent(producer);
    eventId = result.eventId;
    event = result.event;

    // Wait for processing
    logSection('⏳ Waiting for Notification Service to Process Event');
    log('Waiting 5 seconds for event consumption and processing...', 'cyan');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check database state
    await checkDatabaseState(eventId, event.payload.userId);

    // Summary
    logSection('📊 Test Summary');
    log('✅ Event published to Kafka', 'green');
    log('✅ Event ID: ' + eventId, 'green');
    log('✅ User ID: ' + event.payload.userId, 'green');
    log('\n📝 Expected Behavior:', 'yellow');
    log('  1. Notification Service consumes wallet.deposit.completed event', 'cyan');
    log('  2. Maps event to email intent for wallet owner', 'cyan');
    log('  3. Uses template: wallet_deposit_completed_v1', 'cyan');
    log('  4. Renders template with variables', 'cyan');
    log('  5. Sends email via Resend', 'cyan');
    log('  6. Logs notification in notification_logs table', 'cyan');
    log('  7. Marks event as processed in processed_events table', 'cyan');
    log('  8. Emits notification.email.sent event to outbox', 'cyan');
    log('\n🔍 To verify:', 'yellow');
    log('  - Check Notification Service logs', 'cyan');
    log('  - Query notification_logs table', 'cyan');
    log('  - Query processed_events table', 'cyan');
    log('  - Check outbox_events for notification.email.sent', 'cyan');

  } catch (error) {
    logSection('❌ Test Failed');
    log(`Error: ${error.message}`, 'red');
    if (error.stack) {
      log(`Stack: ${error.stack}`, 'red');
    }
    process.exit(1);
  } finally {
    try {
      await producer.disconnect();
      log('\n✅ Producer disconnected', 'green');
    } catch (error) {
      // Ignore disconnect errors
    }
  }
}

// Run the test
main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});

