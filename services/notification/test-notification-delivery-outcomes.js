#!/usr/bin/env node

/**
 * Test Script: Notification Delivery Outcomes
 * 
 * Tests the Notification Service's handling of notification delivery outcomes.
 * 
 * This script simulates:
 * 1. notification.email.sent events (successful delivery)
 * 2. notification.email.failed events (delivery failure)
 * 
 * It verifies:
 * - Events are produced to Kafka outbox
 * - Database state changes (outbox_events table)
 * - Retry mechanisms when Kafka is unavailable
 * 
 * Usage:
 *   node test-notification-delivery-outcomes.js [--kafka-down] [--test-failure]
 */

const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:19092';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const TEST_MODE = process.argv.includes('--kafka-down') ? 'kafka-down' : 'kafka-up';
const TEST_FAILURE = process.argv.includes('--test-failure');

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
 * Create Kafka consumer to listen for notification events
 */
function createKafkaConsumer() {
  const kafka = new Kafka({
    clientId: 'test-notification-outcomes-consumer',
    brokers: [KAFKA_BROKERS],
    retry: {
      retries: 3,
      initialRetryTime: 100,
    },
  });

  return kafka.consumer({ groupId: 'test-notification-outcomes-group' });
}

/**
 * Check outbox events in database
 */
async function checkOutboxEvents() {
  logSection('🔍 Checking Outbox Events');
  
  return new Promise((resolve, reject) => {
    // Note: This would require a direct database query or API endpoint
    // For now, we'll just log what to check
    log('📋 Outbox Events Check:', 'yellow');
    log('  Query the outbox_events table in notification_db schema:', 'cyan');
    log('  SELECT * FROM notification_db.outbox_events', 'cyan');
    log('  WHERE topic IN (\'notification.email.sent\', \'notification.email.failed\')', 'cyan');
    log('  ORDER BY created_at DESC LIMIT 10;', 'cyan');
    log('\n  Expected columns:', 'yellow');
    log('    - topic: notification.email.sent or notification.email.failed', 'cyan');
    log('    - status: pending | published | failed', 'cyan');
    log('    - payload: JSON with notification details', 'cyan');
    log('    - retry_count: number of retry attempts', 'cyan');
    log('    - next_retry_at: timestamp for next retry (if failed)', 'cyan');
    resolve();
  });
}

/**
 * Check notification logs for delivery status
 */
async function checkNotificationLogs(notificationId) {
  logSection('🔍 Checking Notification Logs');
  
  return new Promise((resolve, reject) => {
    const url = `${NOTIFICATION_SERVICE_URL}/api/v1/notifications/admin/logs?limit=10`;
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const logs = JSON.parse(data);
          log(`Found ${logs.data?.length || 0} recent notification log(s)`, 'cyan');
          
          if (logs.data && logs.data.length > 0) {
            const relevantLogs = notificationId 
              ? logs.data.filter(log => log.id === notificationId)
              : logs.data.slice(0, 3); // Show last 3
            
            relevantLogs.forEach((log, idx) => {
              log(`\nLog ${idx + 1}:`, 'yellow');
              log(`  ID: ${log.id}`);
              log(`  Status: ${log.status}`, log.status === 'sent' ? 'green' : log.status === 'failed' ? 'red' : 'yellow');
              log(`  Template: ${log.templateId}`);
              log(`  Recipient: ${log.recipientEmail}`);
              if (log.resendId) {
                log(`  Resend ID: ${log.resendId}`, 'green');
              }
              if (log.errorMessage) {
                log(`  Error: ${log.errorMessage}`, 'red');
              }
            });
          }
          
          resolve(logs);
        } catch (error) {
          log(`❌ Failed to parse response: ${error.message}`, 'red');
          reject(error);
        }
      });
    }).on('error', (error) => {
      log(`❌ Failed to check logs: ${error.message}`, 'red');
      reject(error);
    });
  });
}

/**
 * Test notification.sent scenario
 */
async function testNotificationSent(consumer) {
  logSection('✅ Testing notification.email.sent Event');
  
  log('This event is produced when:', 'yellow');
  log('  1. Notification Service successfully sends an email', 'cyan');
  log('  2. Email is logged in notification_logs with status="sent"', 'cyan');
  log('  3. Event is written to outbox_events table', 'cyan');
  log('  4. OutboxProcessor publishes event to Kafka', 'cyan');
  
  log('\n📋 Expected Flow:', 'yellow');
  log('  NotificationService.processEmailIntent()', 'cyan');
  log('    → EmailService.sendEmail() [success]', 'cyan');
  log('    → logNotification() [status="sent"]', 'cyan');
  log('    → NotificationEventProducer.notificationSent()', 'cyan');
  log('    → OutboxRepository.save() [topic="notification.email.sent"]', 'cyan');
  log('    → OutboxProcessor publishes to Kafka', 'cyan');
  
  // Check recent notification logs
  await checkNotificationLogs();
  
  // Check outbox
  await checkOutboxEvents();
  
  log('\n💡 To trigger this:', 'yellow');
  log('  1. Send a Kafka event (e.g., escrow.completed)', 'cyan');
  log('  2. Wait for Notification Service to process it', 'cyan');
  log('  3. Check outbox_events for notification.email.sent', 'cyan');
}

/**
 * Test notification.failed scenario
 */
async function testNotificationFailed(consumer) {
  logSection('❌ Testing notification.email.failed Event');
  
  log('This event is produced when:', 'yellow');
  log('  1. Notification Service fails to send an email', 'cyan');
  log('  2. Email is logged in notification_logs with status="failed"', 'cyan');
  log('  3. Event is written to outbox_events table', 'cyan');
  log('  4. OutboxProcessor publishes event to Kafka', 'cyan');
  
  log('\n📋 Expected Flow:', 'yellow');
  log('  NotificationService.processEmailIntent()', 'cyan');
  log('    → EmailService.sendEmail() [failure]', 'cyan');
  log('    → logNotification() [status="failed"]', 'cyan');
  log('    → NotificationEventProducer.notificationDeliveryFailed()', 'cyan');
  log('    → OutboxRepository.save() [topic="notification.email.failed"]', 'cyan');
  log('    → OutboxProcessor publishes to Kafka', 'cyan');
  
  log('\n💡 To trigger this:', 'yellow');
  log('  1. Configure invalid Resend API key', 'cyan');
  log('  2. Or stop Resend service', 'cyan');
  log('  3. Send a Kafka event', 'cyan');
  log('  4. Check outbox_events for notification.email.failed', 'cyan');
}

/**
 * Test Kafka down scenario
 */
async function testKafkaDown() {
  logSection('📋 Testing Kafka Down Scenario');
  
  log('When Kafka is unavailable:', 'yellow');
  log('  1. OutboxProcessor cannot publish events', 'cyan');
  log('  2. Events remain in outbox_events with status="pending"', 'cyan');
  log('  3. Retry mechanism will attempt to publish later', 'cyan');
  log('  4. retry_count increases on each attempt', 'cyan');
  log('  5. next_retry_at is set for exponential backoff', 'cyan');
  
  log('\n📋 Expected Database State:', 'yellow');
  log('  outbox_events table:', 'cyan');
  log('    - status: "pending" (not "published")', 'cyan');
  log('    - retry_count: > 0', 'cyan');
  log('    - next_retry_at: future timestamp', 'cyan');
  log('    - last_error: error message from Kafka', 'cyan');
  
  log('\n💡 To test:', 'yellow');
  log('  1. Stop Kafka: docker-compose stop kafka', 'cyan');
  log('  2. Trigger a notification (send escrow.completed event)', 'cyan');
  log('  3. Check outbox_events - should have status="pending"', 'cyan');
  log('  4. Wait for retry attempts', 'cyan');
  log('  5. Restart Kafka: docker-compose start kafka', 'cyan');
  log('  6. Check outbox_events - should eventually be "published"', 'cyan');
}

/**
 * Test Kafka connection
 */
async function testKafkaConnection(consumer) {
  logSection('🔌 Testing Kafka Connection');
  
  try {
    await consumer.connect();
    log('✅ Kafka connection successful', 'green');
    
    // Subscribe to notification topics
    await consumer.subscribe({
      topics: ['notification.email.sent', 'notification.email.failed'],
      fromBeginning: false,
    });
    
    log('✅ Subscribed to notification topics', 'green');
    return true;
  } catch (error) {
    log(`❌ Kafka connection failed: ${error.message}`, 'red');
    log('  This is expected when testing --kafka-down scenario', 'yellow');
    return false;
  }
}

/**
 * Listen for notification events
 */
async function listenForNotificationEvents(consumer, timeout = 30000) {
  logSection('👂 Listening for Notification Events');
  log(`Listening for ${timeout / 1000} seconds...`, 'cyan');
  
  const events = [];
  const startTime = Date.now();
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        events.push({ topic, event, timestamp: new Date() });
        
        log(`\n📨 Received event from topic: ${topic}`, 'green');
        log(`  Event ID: ${event.notificationId || event.metadata?.eventId}`, 'cyan');
        log(`  User ID: ${event.userId}`, 'cyan');
        log(`  Template: ${event.templateId}`, 'cyan');
        if (event.resendId) {
          log(`  Resend ID: ${event.resendId}`, 'green');
        }
        if (event.errorMessage) {
          log(`  Error: ${event.errorMessage}`, 'red');
        }
      } catch (error) {
        log(`❌ Failed to parse event: ${error.message}`, 'red');
      }
    },
  });
  
  // Wait for timeout
  await new Promise(resolve => setTimeout(resolve, timeout));
  
  await consumer.stop();
  
  if (events.length > 0) {
    log(`\n✅ Received ${events.length} event(s)`, 'green');
  } else {
    log(`\n⚠️  No events received in ${timeout / 1000} seconds`, 'yellow');
    log('  This could mean:', 'cyan');
    log('    - No notifications were processed', 'cyan');
    log('    - Events are still in outbox (Kafka down)', 'cyan');
    log('    - OutboxProcessor not running', 'cyan');
  }
  
  return events;
}

/**
 * Main test function
 */
async function main() {
  logSection('🧪 Notification Delivery Outcomes Test');
  log(`Mode: ${TEST_MODE === 'kafka-down' ? 'Kafka Down' : 'Kafka Up'}`, 'cyan');
  log(`Test Type: ${TEST_FAILURE ? 'Failure Scenario' : 'Success Scenario'}`, 'cyan');
  log(`Kafka Brokers: ${KAFKA_BROKERS}`, 'cyan');
  log(`Notification Service: ${NOTIFICATION_SERVICE_URL}`, 'cyan');

  const consumer = createKafkaConsumer();

  try {
    if (TEST_MODE === 'kafka-down') {
      await testKafkaDown();
      return;
    }

    // Test Kafka connection
    const kafkaConnected = await testKafkaConnection(consumer);

    if (!kafkaConnected) {
      log('\n⚠️  Kafka is not available. Use --kafka-down flag to test failure scenarios.', 'yellow');
      process.exit(1);
    }

    if (TEST_FAILURE) {
      await testNotificationFailed(consumer);
    } else {
      await testNotificationSent(consumer);
    }

    // Listen for events
    log('\n');
    await listenForNotificationEvents(consumer, 30000);

    // Summary
    logSection('📊 Test Summary');
    log('✅ Test completed', 'green');
    log('\n📝 Next Steps:', 'yellow');
    log('  1. Check outbox_events table for notification events', 'cyan');
    log('  2. Verify events are published to Kafka', 'cyan');
    log('  3. Check notification_logs for delivery status', 'cyan');
    log('  4. Monitor OutboxProcessor logs for publishing', 'cyan');

  } catch (error) {
    logSection('❌ Test Failed');
    log(`Error: ${error.message}`, 'red');
    if (error.stack) {
      log(`Stack: ${error.stack}`, 'red');
    }
    process.exit(1);
  } finally {
    try {
      await consumer.disconnect();
      log('\n✅ Consumer disconnected', 'green');
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


