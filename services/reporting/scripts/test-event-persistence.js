/**
 * Event Persistence Test Script
 *
 * Validates that the Reporting Service correctly consumes business events
 * and persists them to DailyMetrics and AuditSnapshot.
 *
 * Run: node scripts/test-event-persistence.js
 */

const { Kafka } = require('kafkajs');
const { PrismaClient } = require('../generated/prisma');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'];
const CLIENT_ID = 'test-persistence-producer';

// Topics
const WALLET_TOPIC = 'wallet.events';
const ADMIN_TOPIC = 'admin.action';

const prisma = new PrismaClient();
const kafka = new Kafka({
    clientId: CLIENT_ID,
    brokers: KAFKA_BROKERS,
    retry: { retries: 2 },
});

const producer = kafka.producer();

async function runTest() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   EVENT PERSISTENCE TEST');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        console.log('🔌 Connecting to Kafka and Database...');
        await producer.connect();
        await prisma.$connect();
        console.log('✅ Connected.');

        // ==========================================
        // TEST 1: Wallet Deposit (DailyMetrics & Audit)
        // ==========================================
        console.log('\n-----------------------------------------------------------');
        console.log('🧪 TEST 1: Wallet Deposit Verification');
        console.log('-----------------------------------------------------------');

        const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
        const userId = crypto.randomUUID();
        const amount = 1000.50;
        const currency = 'USDC';

        const depositEvent = {
            metadata: {
                eventId: crypto.randomUUID(),
                eventType: 'WalletDeposited',
                timestamp: new Date().toISOString(),
                source: 'test-script',
                version: '1.0.0',
                correlationId: crypto.randomUUID(),
            },
            payload: {
                userId,
                walletId: crypto.randomUUID(),
                currency,
                amount,
                txHash,
                status: 'CONFIRMED'
            }
        };

        // Capture metrics before
        const dateOnly = new Date(new Date().toISOString().split('T')[0]);
        const metricsBefore = await prisma.dailyMetrics.findUnique({ where: { date: dateOnly } });
        const initialDeposits = metricsBefore ? Number(metricsBefore.totalDeposits) : 0;

        console.log(`📊 Initial Total Deposits: ${initialDeposits}`);
        console.log(`📤 Producing WalletDeposited event...`);

        await producer.send({
            topic: WALLET_TOPIC,
            messages: [{ key: userId, value: JSON.stringify(depositEvent) }],
        });

        console.log('⏳ Waiting for processing (5s)...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify Daily Metrics
        const metricsAfter = await prisma.dailyMetrics.findUnique({ where: { date: dateOnly } });
        const finalDeposits = metricsAfter ? Number(metricsAfter.totalDeposits) : 0;

        console.log(`📊 Final Total Deposits:   ${finalDeposits}`);

        const allMetrics = await prisma.dailyMetrics.findUnique({ where: { date: dateOnly } });

        if (Math.abs((finalDeposits - initialDeposits) - amount) < 0.01) {
            console.log('✅ DailyMetrics updated correctly (+1000.50)');
        } else {
            console.error('❌ DailyMetrics mismatch!');
            console.error(`Expected increment: ${amount}, Actual: ${finalDeposits - initialDeposits}`);
            console.log(`Date used for query: ${dateOnly.toISOString()}`);
        }

        // Verify Audit Snapshot
        const audit = await prisma.auditSnapshot.findFirst({
            where: { referenceId: txHash, eventType: 'deposit' }
        });

        if (audit) {
            console.log('✅ AuditSnapshot created for deposit.');
            console.log(`   ID: ${audit.id}, Amount: ${audit.amount}`);
        } else {
            console.error('❌ AuditSnapshot NOT found for deposit!');
        }

        // ==========================================
        // TEST 2: Admin Audit (AuditSnapshot Only)
        // ==========================================
        console.log('\n-----------------------------------------------------------');
        console.log('🧪 TEST 2: Admin Action Verification');
        console.log('-----------------------------------------------------------');

        const adminId = crypto.randomUUID();
        const targetId = 'target-user-123';
        const action = 'USER_BAN';
        const adminEventId = crypto.randomUUID();

        const adminEvent = {
            metadata: {
                eventId: adminEventId,
                eventType: 'AdminAction', // This usually maps to key, but let's see handler
                timestamp: new Date().toISOString(),
                source: 'test-script',
                version: '1.0.0',
            },
            payload: {
                action,
                adminId,
                targetId,
                details: { reason: 'Test Ban' }
            }
        };

        console.log(`📤 Producing AdminAction event...`);
        // Note: AdminAuditHandler validates event type 'ADMIN_AUDIT'. 
        // We need to ensure metadata mappings are correct. 
        // Based on handlers/admin-audit.handler.ts, it checks validation 'ADMIN_AUDIT'.
        // Assuming validation service checks eventType or topic. 
        // Let's rely on standard patterns.

        await producer.send({
            topic: ADMIN_TOPIC,
            messages: [{ key: adminId, value: JSON.stringify(adminEvent) }],
        });

        console.log('⏳ Waiting for processing (5s)...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const adminAudit = await prisma.auditSnapshot.findFirst({
            where: {
                eventType: 'admin_user_ban',
                userId: adminId,
                createdAt: { gte: new Date(Date.now() - 10000) }
            }
        });

        if (adminAudit) {
            console.log('✅ AuditSnapshot created for admin action.');
            console.log(`   ID: ${adminAudit.id}, Type: ${adminAudit.eventType}`);
            console.log(`   Target: ${adminAudit.referenceId}`);
        } else {
            console.error('❌ AuditSnapshot NOT found for admin action!');
            // Debug note: check raw logs if failed.
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🎉 EVENT PERSISTENCE TEST COMPLETE');
        console.log('═══════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
    } finally {
        await producer.disconnect();
        await prisma.$disconnect();
    }
}

runTest();
