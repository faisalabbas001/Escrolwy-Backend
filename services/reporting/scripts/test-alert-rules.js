/**
 * Alert Rules Persistence Test Script
 *
 * Verifies that the Create Alert Rule API correctly persists data to the database.
 *
 * Run: node scripts/test-alert-rules.js
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3007/api/v1';

// Generate a valid JWT for testing
function generateToken() {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmIzNTU2My03ZWNmLTQ2ZmUtYjYzYS0zODFlZjMwZTlkMTkiLCJlbWFpbCI6InRhbGhhcmlhenRlc3RzcjEyM3cyMzIzQGdtYWlsLmNvbSIsInJvbGUiOiJ1c2VyIiwic2Vzc2lvbklkIjoiODhiYzc4MzgtYTljYy00YmVmLThmNWQtODc1Y2QyMzU2Zjk2IiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NzE5MjA1NywiZXhwIjoxNzY3MTkyOTU3LCJhdWQiOiJlc2Nyb3dseSIsImlzcyI6ImVzY3Jvd2x5LWF1dGgifQ.skP-2E8qNpfjIUMIj_tyzFB0dwLwPakA6r2imUXu93s';
}

async function runTest() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   ALERT RULE PERSISTENCE TEST');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        await prisma.$connect();
        const token = generateToken();

        // 1. Define Rule Payload
        const ruleData = {
            ruleType: 'TEST_RULE_' + Math.floor(Math.random() * 10000),
            conditionExpression: 'latency > 500ms',
            threshold: 500,
            severity: 'HIGH',
            action: 'email,slack',
            isActive: true
        };

        console.log('📤 Sending POST /alerts/rules request...');
        console.log('   Payload:', JSON.stringify(ruleData, null, 2));

        // 2. Call API
        try {
            const response = await axios.post(`${API_URL}/alerts/rules`, ruleData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ API Response:', response.status, response.data);
        } catch (error) {
            console.error('❌ API Call Failed:', error.response ? error.response.data : error.message);
            throw error;
        }

        // 3. Verify Database
        console.log('🔍 Verifying database persistence...');
        const savedRule = await prisma.alertRule.findFirst({
            where: { ruleType: ruleData.ruleType }
        });

        if (savedRule) {
            console.log('✅ Rule found in database!');
            console.log('   ID:', savedRule.id);
            console.log('   Type:', savedRule.ruleType);
            console.log('   Threshold:', savedRule.threshold.toString());
        } else {
            console.error('❌ Rule NOT found in database!');
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🎉 ALERT RULE TEST COMPLETE');
        console.log('═══════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
