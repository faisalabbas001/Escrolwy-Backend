/**
 * Reporting Service - API Test Script
 *
 * Tests all 21 API endpoints of the Reporting Service.
 * Run: node scripts/test-reporting-apis.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read .env file manually to get secrets
let envConfig = {};
try {
    const envPath = path.join(__dirname, '../src/.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                envConfig[key] = value;
            }
        });
        console.log('Loaded .env configuration');
    }
} catch (e) {
    console.error('Failed to load .env', e.message);
}

const BASE_URL = process.env.REPORTING_URL || 'http://localhost:3007/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || envConfig.JWT_SECRET || 'dev-secret';
const JWT_ISSUER = process.env.JWT_ISSUER || envConfig.JWT_ISSUER || 'escrowly-auth-service';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || envConfig.JWT_AUDIENCE || 'escrowly-platform';

// Color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Generate valid JWT
function generateToken() {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        sub: 'test-user-id',
        email: 'test@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: JWT_AUDIENCE,
        iss: JWT_ISSUER
    };

    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const tokenBase = `${encode(header)}.${encode(payload)}`;
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(tokenBase).digest('base64url');

    return `${tokenBase}.${signature}`;
}

const AUTH_TOKEN = generateToken();

async function fetchJson(url, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (options.auth !== false) {
            headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        let data = null;
        try {
            data = await response.json();
        } catch (e) { } // ignore empty bodies

        return { status: response.status, data };
    } catch (error) {
        return { status: 500, error: error.message };
    }
}

const results = { passed: 0, failed: 0, tests: [] };

async function test(name, method, path, expectedStatus = 200, body = null, auth = true) {
    const url = `${BASE_URL}${path}`;
    const options = { method, auth };
    if (body) options.body = JSON.stringify(body);

    const { status, data, error } = await fetchJson(url, options);
    const passed = status === expectedStatus;

    if (passed) {
        log(`✅ ${name}`, 'green');
        results.passed++;
    } else {
        log(`❌ ${name} - Expected ${expectedStatus}, got ${status}`, 'red');
        if (error) log(`   Error: ${error}`, 'yellow');
        if (status === 401) log(`   Auth error: Access Denied (Iss: ${JWT_ISSUER}, Aud: ${JWT_AUDIENCE})`, 'yellow');
        if (data && data.message) log(`   Message: ${JSON.stringify(data.message)}`, 'yellow');
        results.failed++;
    }

    results.tests.push({ name, path, method, expectedStatus, actualStatus: status, passed });
    return { passed, data };
}

async function runTests() {
    log('\n═══════════════════════════════════════════════════════════', 'cyan');
    log('   REPORTING SERVICE - API TEST SUITE', 'bold');
    log('═══════════════════════════════════════════════════════════\n', 'cyan');

    // Check if secret loaded
    if (JWT_SECRET === 'dev-secret' && !process.env.JWT_SECRET && !envConfig.JWT_SECRET) {
        log('⚠️ WARNING: Using default "dev-secret" for JWT signing.', 'yellow');
    }

    log('📋 Testing Health Endpoints (Public)...', 'yellow');
    await test('Health Check', 'GET', '/health', 200, null, false);
    await test('Readiness Check', 'GET', '/health/ready', 200, null, false);
    await test('Liveness Check', 'GET', '/health/live', 200, null, false);

    log('\n📊 Testing Reports - Escrow & Transactions (Protected)...', 'yellow');
    await test('Get Escrow Summary', 'GET', '/reports/escrows/summary');
    await test('Get Escrow Trends', 'GET', '/reports/escrows/trends');
    await test('Get Transaction Volume', 'GET', '/reports/transactions/volume');
    await test('Get Fees Report', 'GET', '/reports/fees');
    await test('Get Currency Breakdown', 'GET', '/reports/currencies');

    log('\n👥 Testing Reports - Users & Wallets...', 'yellow');
    await test('Get KYC Distribution', 'GET', '/reports/users/kyc-distribution');
    await test('Get Active Users', 'GET', '/reports/users/active');
    await test('Get Wallet Deposits', 'GET', '/reports/wallets/deposits');
    await test('Get Wallet Withdrawals', 'GET', '/reports/wallets/withdrawals');

    log('\n⚙️ Testing System Metrics...', 'yellow');
    await test('Get Listener Metrics', 'GET', '/metrics/listeners');
    await test('Get Event Metrics', 'GET', '/metrics/events');
    await test('Get Error Metrics', 'GET', '/metrics/errors');
    await test('Get Hot Wallet Metrics', 'GET', '/metrics/hot-wallets');
    await test('Get Audit Metrics', 'GET', '/metrics/audit');

    log('\n🚨 Testing Alerts...', 'yellow');
    await test('Get Active Alerts', 'GET', '/alerts');
    await test('Get Alert History', 'GET', '/alerts/history');
    await test('Get Alert Rules', 'GET', '/alerts/rules');

    log('\n📤 Testing Exports...', 'yellow');
    await test('Get Daily Export', 'GET', '/exports/daily');
    await test('Trigger Manual Export', 'GET', '/exports/manual');

    log('\n' + '════'.repeat(15), 'cyan');
    log(`Total: ${results.passed + results.failed} | Passed: ${results.passed} | Failed: ${results.failed}`);

    if (results.failed > 0) {
        log('Failed Tests:', 'red');
        results.tests.filter(t => !t.passed).forEach(t => log(`  - ${t.name}`, 'red'));
        return 1;
    }
    return 0;
}

runTests().then(code => process.exit(code));
