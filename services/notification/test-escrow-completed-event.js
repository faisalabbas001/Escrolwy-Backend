#!/usr/bin/env node

/**
 * Test Script: Escrow Completed Event
 * 
 * Tests the Notification Service handling of escrow.completed events.
 * 
 * This script:
 * 1. Publishes an escrow.completed event to Kafka
 * 2. Waits for the Notification Service to consume and process it
 * 3. Verifies database state changes (logs, processed events)
 * 4. Tests both Kafka healthy and unavailable scenarios
 * 
 * Usage:
 *   node test-escrow-completed-event.js [--kafka-down]
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
    clientId: 'test-escrow-completed-producer',
    brokers: [KAFKA_BROKERS],
    retry: {
      retries: 3,
      initialRetryTime: 100,
    },
  });

  return kafka.producer();
}

/**
 * Publish escrow completed event to Kafka
 */
async function publishEscrowCompletedEvent(producer) {
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();
  const escrowId = `escrow-${uuidv4()}`;
  const buyerId = `user-buyer-${uuidv4()}`;
  const sellerId = `user-seller-${uuidv4()}`;
  
  const event = {
    metadata: {
      eventId,
      timestamp,
      eventType: 'escrow.completed',
      source: 'escrow-service',
      version: '1.0',
      correlationId: `test-${Date.now()}`,
    },
    payload: {
      escrowId,
      buyerId,
      sellerId,
      amount: 1500.75,
      asset: 'USDT',
      platformFee: 15.01,
      completedAt: timestamp,
      ledgerAction: 'release_to_seller',
    },
  };

  logSection('📤 Publishing Escrow Completed Event');
  log(`Event ID: ${eventId}`, 'cyan');
  log(`Escrow ID: ${escrowId}`, 'cyan');
  log(`Buyer ID: ${buyerId}`, 'cyan');
  log(`Seller ID: ${sellerId}`, 'cyan');
  log(`Amount: ${event.payload.amount} ${event.payload.asset}`, 'cyan');
  log(`Platform Fee: ${event.payload.platformFee}`, 'cyan');
  log(`Completed At: ${event.payload.completedAt}`, 'cyan');

  try {
    await producer.send({
      topic: 'escrow.completed',
      messages: [
        {
          key: escrowId,
          value: JSON.stringify(event),
          headers: {
            'event-type': 'escrow.completed',
            'event-id': eventId,
          },
        },
      ],
    });

    log('✅ Event published to Kafka successfully', 'green');
    return { eventId, event, escrowId, sellerId };
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
    // Check health endpoint
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
      log('  Service might not be running or health endpoint unavailable', 'cyan');
      resolve(null);
    });
  });
}

/**
 * Check database state via API
 */
async function checkDatabaseState(eventId, sellerId) {
  logSection('🔍 Checking Database State');

  return new Promise((resolve, reject) => {
    // Check notification logs
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
              log(`  Event Key: ${log.eventKey}`);
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

            // Verify expected behavior
            const sellerNotification = logs.data.find(log => log.userId === sellerId);
            if (sellerNotification) {
              log('\n✅ Seller notification found', 'green');
              log(`   Template: ${sellerNotification.templateId}`, 'cyan');
              log(`   Expected: escrow_completed_v1`, 'cyan');
              if (sellerNotification.templateId === 'escrow_completed_v1') {
                log('   ✅ Correct template used', 'green');
              } else {
                log('   ⚠️  Template mismatch', 'yellow');
              }
            } else {
              log('\n⚠️  Seller notification not found', 'yellow');
            }
          } else {
            log('⚠️  No notification logs found yet', 'yellow');
            log('   This could mean:', 'cyan');
            log('   - Event not consumed yet (wait longer)', 'cyan');
            log('   - Kafka consumer not running', 'cyan');
            log('   - Event processing failed', 'cyan');
          }

          resolve(logs);
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
 * Wait and retry checking database
 */
async function waitAndCheckDatabase(eventId, sellerId, maxRetries = 6, delay = 2000) {
  logSection('⏳ Waiting for Notification Service to Process Event');
  
  for (let i = 0; i < maxRetries; i++) {
    log(`Attempt ${i + 1}/${maxRetries} (waiting ${delay}ms)...`, 'cyan');
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const logs = await checkDatabaseState(eventId, sellerId);
      if (logs.data && logs.data.length > 0) {
        log('\n✅ Notification processed!', 'green');
        return logs;
      }
    } catch (error) {
      log(`Attempt ${i + 1} failed: ${error.message}`, 'yellow');
    }
  }
  
  log('\n⚠️  No notifications found after all retries', 'yellow');
  return null;
}

/**
 * Main test function
 */
async function main() {
  logSection('🧪 Escrow Completed Event Test');
  log(`Mode: ${TEST_MODE === 'kafka-down' ? 'Kafka Down (Testing Failure Handling)' : 'Kafka Up (Normal Flow)'}`, 'cyan');
  log(`Kafka Brokers: ${KAFKA_BROKERS}`, 'cyan');
  log(`Notification Service: ${NOTIFICATION_SERVICE_URL}`, 'cyan');

  const producer = createKafkaProducer();
  let eventId, event, escrowId, sellerId;

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
    const result = await publishEscrowCompletedEvent(producer);
    eventId = result.eventId;
    event = result.event;
    escrowId = result.escrowId;
    sellerId = result.sellerId;

    // Wait for processing with retries
    await waitAndCheckDatabase(eventId, sellerId);

    // Summary
    logSection('📊 Test Summary');
    log('✅ Event published to Kafka', 'green');
    log(`✅ Event ID: ${eventId}`, 'cyan');
    log(`✅ Escrow ID: ${escrowId}`, 'cyan');
    log('\n📝 Expected Behavior:', 'yellow');
    log('  1. Notification Service consumes escrow.completed event', 'cyan');
    log('  2. Maps event to email intent for seller', 'cyan');
    log('  3. Uses template: escrow_completed_v1', 'cyan');
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

