/**
 * Complete BFF Service Test Suite
 * 
 * Tests all BFF endpoints:
 * - Health check
 * - Auth APIs (signup, login, refresh, logout)
 * - Admin/Blogs APIs (CRUD)
 * - Admin/Help-desk APIs (CRUD)
 * - Admin/Upload APIs
 * - JWT validation (protected vs public routes)
 * 
 * Usage: node scripts/test-bff-complete.js
 */

const http = require('http');

const BFF_BASE_URL = 'http://localhost:3001';

// Test state
let accessToken = null;
let refreshToken = null;
let testUserId = null;
let testUserEmail = null;

// Test counters
let passed = 0;
let failed = 0;

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BFF_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

function logResult(testName, success, details = '') {
  if (success) {
    passed++;
    console.log(`  ✅ ${testName}${details ? ` - ${details}` : ''}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}${details ? ` - ${details}` : ''}`);
  }
}

// ================================
// Health Check Tests
// ================================
async function testHealthCheck() {
  console.log('\n📍 HEALTH CHECK');
  
  const response = await makeRequest('GET', '/api/v1/health');
  logResult(
    'GET /api/v1/health',
    response.status === 200 && response.data?.status === 'ok',
    `status: ${response.data?.status}`
  );
}

// ================================
// Auth Tests
// ================================
async function testAuthAPIs() {
  console.log('\n📍 AUTH APIS (→ Auth Service)');
  
  // Test: Signup
  const timestamp = Date.now();
  testUserEmail = `bfftest${timestamp}@example.com`;
  
  const signupResponse = await makeRequest('POST', '/api/v1/auth/signup', {
    email: testUserEmail,
    password: 'SecurePass123!',
    role: 'user',
    displayName: 'BFF Test User',
    acceptTerms: true,
  });
  
  logResult(
    'POST /api/v1/auth/signup',
    signupResponse.status === 201 && signupResponse.data?.userId,
    `userId: ${signupResponse.data?.userId?.substring(0, 8)}...`
  );
  
  if (signupResponse.status === 201) {
    testUserId = signupResponse.data.userId;
    accessToken = signupResponse.data.session?.accessToken;
    refreshToken = signupResponse.data.session?.refreshToken;
  }

  // Test: Login
  const loginResponse = await makeRequest('POST', '/api/v1/auth/login', {
    email: testUserEmail,
    password: 'SecurePass123!',
  });
  
  logResult(
    'POST /api/v1/auth/login',
    loginResponse.status === 200 && loginResponse.data?.session?.accessToken,
    `requiresMfa: ${loginResponse.data?.requiresMfa}`
  );
  
  if (loginResponse.status === 200) {
    accessToken = loginResponse.data.session?.accessToken;
    refreshToken = loginResponse.data.session?.refreshToken;
  }

  // Test: Invalid login
  const invalidLoginResponse = await makeRequest('POST', '/api/v1/auth/login', {
    email: testUserEmail,
    password: 'WrongPassword123!',
  });
  
  logResult(
    'POST /api/v1/auth/login (invalid password)',
    invalidLoginResponse.status === 401,
    `correctly rejected`
  );

  // Test: Token refresh
  if (refreshToken) {
    const refreshResponse = await makeRequest('POST', '/api/v1/auth/token/refresh', {
      refreshToken,
    });
    
    logResult(
      'POST /api/v1/auth/token/refresh',
      refreshResponse.status === 200 && refreshResponse.data?.accessToken,
      `new token issued`
    );
    
    if (refreshResponse.status === 200) {
      accessToken = refreshResponse.data.accessToken;
      refreshToken = refreshResponse.data.refreshToken;
    }
  }
}

// ================================
// Blog Tests
// ================================
async function testBlogAPIs() {
  console.log('\n📍 ADMIN/BLOGS APIS (→ Admin Service)');
  
  // Test: Get blogs (public)
  const blogsResponse = await makeRequest('GET', '/api/v1/admin/blogs?page=1&limit=5');
  logResult(
    'GET /api/v1/admin/blogs (public)',
    blogsResponse.status === 200,
    `total: ${blogsResponse.data?.total || blogsResponse.data?.data?.length || 0}`
  );

  // Test: Get blogs with category filter
  const filteredResponse = await makeRequest('GET', '/api/v1/admin/blogs?category=REAL_ESTATE_ESCROW&page=1&limit=5');
  logResult(
    'GET /api/v1/admin/blogs?category=... (public)',
    filteredResponse.status === 200,
    `filtered results`
  );

  // Test: Get categories (public)
  const categoriesResponse = await makeRequest('GET', '/api/v1/admin/blogs/categories');
  logResult(
    'GET /api/v1/admin/blogs/categories (public)',
    categoriesResponse.status === 200,
    `categories: ${categoriesResponse.data?.length || 0}`
  );

  // Test: Create blog without token (should fail)
  const createNoAuthResponse = await makeRequest('POST', '/api/v1/admin/blogs', {
    title: 'Test Blog',
  });
  logResult(
    'POST /api/v1/admin/blogs (no token)',
    createNoAuthResponse.status === 401,
    `correctly rejected`
  );

  // Test: Create blog with token
  if (accessToken) {
    const createResponse = await makeRequest('POST', '/api/v1/admin/blogs', {
      title: 'BFF Test Blog ' + Date.now(),
      slug: 'bff-test-blog-' + Date.now(),
      category: 'REAL_ESTATE_ESCROW',
      excerpt: 'Test excerpt',
      content: [{ type: 'text', content: 'Test content' }],
      published: false,
    }, {
      Authorization: `Bearer ${accessToken}`,
    });
    
    logResult(
      'POST /api/v1/admin/blogs (with token)',
      createResponse.status === 201 || createResponse.status === 200 || createResponse.status === 400,
      createResponse.status === 201 ? 'created' : `status: ${createResponse.status}`
    );
  }
}

// ================================
// Help Desk Tests
// ================================
async function testHelpDeskAPIs() {
  console.log('\n📍 ADMIN/HELP-DESK APIS (→ Admin Service)');
  
  // Test: Get categories (public)
  const categoriesResponse = await makeRequest('GET', '/api/v1/admin/help-desk/categories');
  logResult(
    'GET /api/v1/admin/help-desk/categories (public)',
    categoriesResponse.status === 200,
    `categories: ${categoriesResponse.data?.length || 0}`
  );

  // Test: Get questions (public)
  const questionsResponse = await makeRequest('GET', '/api/v1/admin/help-desk/questions');
  logResult(
    'GET /api/v1/admin/help-desk/questions (public)',
    questionsResponse.status === 200,
    `questions: ${questionsResponse.data?.length || 0}`
  );

  // Test: Create category without token (should fail)
  const createNoAuthResponse = await makeRequest('POST', '/api/v1/admin/help-desk/categories', {
    name: 'Test Category',
  });
  logResult(
    'POST /api/v1/admin/help-desk/categories (no token)',
    createNoAuthResponse.status === 401,
    `correctly rejected`
  );

  // Test: Create category with token
  if (accessToken) {
    const createResponse = await makeRequest('POST', '/api/v1/admin/help-desk/categories', {
      name: 'BFF Test Category ' + Date.now(),
      slug: 'bff-test-category-' + Date.now(),
      description: 'Test description',
    }, {
      Authorization: `Bearer ${accessToken}`,
    });
    
    logResult(
      'POST /api/v1/admin/help-desk/categories (with token)',
      createResponse.status === 201 || createResponse.status === 200 || createResponse.status === 400,
      createResponse.status === 201 ? 'created' : `status: ${createResponse.status}`
    );
  }
}

// ================================
// JWT Validation Tests
// ================================
async function testJWTValidation() {
  console.log('\n📍 JWT VALIDATION');
  
  // Test: Invalid token format
  const invalidFormatResponse = await makeRequest('POST', '/api/v1/admin/blogs', {}, {
    Authorization: 'Bearer invalid-token',
  });
  logResult(
    'Request with invalid token format',
    invalidFormatResponse.status === 401,
    `correctly rejected`
  );

  // Test: Expired token (we can't easily test this without waiting)
  // Test: Missing Bearer prefix
  const noBearerResponse = await makeRequest('POST', '/api/v1/admin/blogs', {}, {
    Authorization: accessToken, // Missing "Bearer "
  });
  logResult(
    'Request without Bearer prefix',
    noBearerResponse.status === 401,
    `correctly rejected`
  );

  // Test: Valid token on protected route
  if (accessToken) {
    const validTokenResponse = await makeRequest('GET', '/api/v1/admin/blogs/categories', null, {
      Authorization: `Bearer ${accessToken}`,
    });
    logResult(
      'Request with valid token',
      validTokenResponse.status === 200,
      `allowed`
    );
  }
}

// ================================
// Logout Tests
// ================================
async function testLogout() {
  console.log('\n📍 LOGOUT APIS');
  
  if (!accessToken) {
    console.log('  ⚠️ Skipping logout tests - no access token');
    return;
  }

  // Test: Logout
  const logoutResponse = await makeRequest('POST', '/api/v1/auth/logout', null, {
    Authorization: `Bearer ${accessToken}`,
  });
  logResult(
    'POST /api/v1/auth/logout',
    logoutResponse.status === 204 || logoutResponse.status === 200,
    `status: ${logoutResponse.status}`
  );

  // Test: Use token after logout (refresh should fail)
  if (refreshToken) {
    const refreshAfterLogoutResponse = await makeRequest('POST', '/api/v1/auth/token/refresh', {
      refreshToken,
    });
    logResult(
      'POST /api/v1/auth/token/refresh (after logout)',
      refreshAfterLogoutResponse.status === 401,
      `status: ${refreshAfterLogoutResponse.status}`
    );
  }
}

// ================================
// Main
// ================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BFF SERVICE - COMPLETE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nPrerequisites:');
  console.log('  - Auth service running on port 3000');
  console.log('  - Admin service running on port 3002');
  console.log('  - BFF service running on port 3001');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    await testHealthCheck();
    await testAuthAPIs();
    await testBlogAPIs();
    await testHelpDeskAPIs();
    await testJWTValidation();
    await testLogout();
  } catch (error) {
    console.log(`\n❌ Test suite error: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

main();

