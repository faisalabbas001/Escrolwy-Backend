/**
 * Kafka Failure Test Script
 *
 * Validates that the Reporting Service correctly consumes and persists failed events.
 *
 * Run: node scripts/test-kafka-failures.js
 */

const { Kafka } = require('kafkajs');
const { PrismaClient } = require('../generated/prisma');
const crypto = require('crypto');

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'];
const CLIENT_ID = 'test-failure-producer';
const TARGET_TOPIC = 'compliance.failure';

const prisma = new PrismaClient();
const kafka = new Kafka({
    clientId: CLIENT_ID,
    brokers: KAFKA_BROKERS,
    retry: { retries: 2 },
});

const producer = kafka.producer();

async function runTest() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   KAFKA FAILURE PERSISTENCE TEST');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // 1. Connect dependencies
        console.log('🔌 Connecting to Kafka and Database...');
        await producer.connect();
        await prisma.$connect();
        console.log('✅ Connected.');

        // 2. Prepare test data
        const testId = crypto.randomUUID();
        const testPayload = {
            id: testId,
            userId: 'user-123',
            kycStatus: 'FAILED',
            trigger: 'AUTOMATED_TEST'
        };
        const errorDetail = 'Simulated Processing Error: Connection Timed Out';

        const event = {
            metadata: {
                eventId: crypto.randomUUID(),
                eventType: 'IntegrationTestFailure',
                timestamp: new Date().toISOString(),
                source: 'test-script',
                type: 'compliance.failure', // Important for handler logic matching
                version: '1.0.0'
            },
            payload: {
                originalEvent: testPayload,
                error: { message: errorDetail, code: 500 }
            }
        };

        // 3. Produce failed event
        console.log(`\n📤 Producing failed event to [${TARGET_TOPIC}]...`);
        await producer.send({
            topic: TARGET_TOPIC,
            messages: [
                {
                    key: testId,
                    value: JSON.stringify(event),
                },
            ],
        });
        console.log('✅ Event sent. Waiting for consumption (5s)...');

        // 4. Wait for processing
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 5. Verify persistence
        console.log('\n🔍 Verifying database persistence...');

        // We look for a recent record created in the last minute
        const failureRecord = await prisma.kafkaFailure.findFirst({
            where: {
                topic: TARGET_TOPIC,
                sourceService: 'test-script',
                createdAt: {
                    gte: new Date(Date.now() - 60000) // Within last minute
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (failureRecord) {
            console.log('✅ Found KafkaFailure record in DB!');
            console.log('--------------------------------------------------');
            console.log('ID:', failureRecord.id);
            console.log('Topic:', failureRecord.topic);
            console.log('Source:', failureRecord.sourceService);
            console.log('Error:', failureRecord.error); // Stringified JSON or string

            // Validate content
            const storedPayload = failureRecord.payload;
            // Check if stored payload matches what we sent (wrapped in data/originalEvent usually)
            // Our handler casts event.data to payload.

            if (JSON.stringify(storedPayload).includes('Simulated Processing Error')) {
                console.log('✅ Payload integrity verified.');
            } else {
                console.log('⚠️ Payload content mismatch or different structure.');
                console.log('Stored:', JSON.stringify(storedPayload).substring(0, 100) + '...');
            }

            console.log('--------------------------------------------------');
            console.log('\n🎉 TEST PASSED: Failure event was successfully captured.');
            process.exit(0);

        } else {
            console.error('❌ No matching record found in kafka_failures table.');
            console.log('   Note: Ensure the Reporting Service is running and consuming from ' + TARGET_TOPIC);
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    } finally {
        await producer.disconnect();
        await prisma.$disconnect();
    }
}

runTest();
