/**
 * Test Script: Auth Login API
 * 
 * Usage: node scripts/test-auth-login.js
 * 
 * Prerequisites:
 * - Auth service running on port 3001
 * - A user created via signup (run test-auth-signup.js first)
 */

const http = require('http');

const AUTH_BASE_URL = 'http://localhost:3000';

// Test user credentials (will be created during test)
let TEST_USER = {
  email: null,
  password: 'SecurePass123!',
};

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, AUTH_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
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

async function createTestUser() {
  console.log('📝 Creating test user for login tests...');
  
  const timestamp = Date.now();
  TEST_USER.email = `logintest${timestamp}@example.com`;
  
  const signupData = {
    email: TEST_USER.email,
    password: TEST_USER.password,
    role: 'user',
    displayName: 'Login Test User',
    acceptTerms: true,
  };

  const response = await makeRequest('POST', '/api/v1/auth/signup', signupData);
  
  if (response.status === 201) {
    console.log('✅ Test user created:', TEST_USER.email);
    return response.data;
  } else {
    console.log('❌ Failed to create test user:', response.data);
    return null;
  }
}

async function testSuccessfulLogin() {
  console.log('\n📝 Test 1: Successful login');
  
  const loginData = {
    email: TEST_USER.email,
    password: TEST_USER.password,
    device: {
      name: 'Test Script',
      ip: '127.0.0.1',
    },
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/login', loginData);
    
    if (response.status === 200) {
      console.log('✅ Login successful!');
      console.log('   User ID:', response.data.userId);
      console.log('   Role:', response.data.role);
      console.log('   Requires MFA:', response.data.requiresMfa);
      console.log('   Access Token:', response.data.session?.accessToken?.substring(0, 50) + '...');
      console.log('   Refresh Token:', response.data.session?.refreshToken?.substring(0, 50) + '...');
      return response.data;
    } else {
      console.log('❌ Login failed!');
      console.log('   Status:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return null;
  }
}

async function testInvalidPassword() {
  console.log('\n📝 Test 2: Invalid password');
  
  const loginData = {
    email: TEST_USER.email,
    password: 'WrongPassword123!',
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/login', loginData);
    
    if (response.status === 401) {
      console.log('✅ Correctly rejected invalid password!');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 401 Unauthorized, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function testNonExistentUser() {
  console.log('\n📝 Test 3: Non-existent user');
  
  const loginData = {
    email: 'nonexistent@example.com',
    password: 'SomePassword123!',
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/login', loginData);
    
    if (response.status === 401) {
      console.log('✅ Correctly rejected non-existent user!');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 401 Unauthorized, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function testTokenRefresh(refreshToken) {
  console.log('\n📝 Test 4: Token refresh');
  
  if (!refreshToken) {
    console.log('⚠️ Skipping - no refresh token available');
    return null;
  }

  const refreshData = {
    refreshToken,
    device: {
      name: 'Test Script',
      ip: '127.0.0.1',
    },
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/token/refresh', refreshData);
    
    if (response.status === 200) {
      console.log('✅ Token refresh successful!');
      console.log('   New Access Token:', response.data.accessToken?.substring(0, 50) + '...');
      console.log('   New Refresh Token:', response.data.refreshToken?.substring(0, 50) + '...');
      console.log('   Access Expires In:', response.data.accessExpiresIn, 'seconds');
      console.log('   Refresh Expires In:', response.data.refreshExpiresIn, 'seconds');
      return response.data;
    } else {
      console.log('❌ Token refresh failed!');
      console.log('   Status:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return null;
  }
}

async function testLogout(accessToken) {
  console.log('\n📝 Test 5: Logout');
  
  if (!accessToken) {
    console.log('⚠️ Skipping - no access token available');
    return;
  }

  try {
    const response = await makeRequest('POST', '/api/v1/auth/logout', null, {
      Authorization: `Bearer ${accessToken}`,
    });
    
    if (response.status === 204) {
      console.log('✅ Logout successful!');
    } else {
      console.log('❌ Logout failed!');
      console.log('   Status:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function testRefreshAfterLogout(refreshToken) {
  console.log('\n📝 Test 6: Refresh after logout (should fail)');
  
  if (!refreshToken) {
    console.log('⚠️ Skipping - no refresh token available');
    return;
  }

  const refreshData = {
    refreshToken,
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/token/refresh', refreshData);
    
    if (response.status === 401) {
      console.log('✅ Correctly rejected refresh after logout!');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 401 Unauthorized, got:', response.status);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Auth Service Login Tests\n');
  console.log('Make sure the auth service is running: npm run auth:dev');
  console.log('=' .repeat(50));

  // Create test user
  const signupResult = await createTestUser();
  if (!signupResult) {
    console.log('\n❌ Cannot proceed without test user');
    return;
  }

  // Run tests
  const loginResult = await testSuccessfulLogin();
  await testInvalidPassword();
  await testNonExistentUser();
  
  let refreshResult = null;
  if (loginResult?.session?.refreshToken) {
    refreshResult = await testTokenRefresh(loginResult.session.refreshToken);
  }
  
  // Test logout
  if (refreshResult?.accessToken) {
    await testLogout(refreshResult.accessToken);
    await testRefreshAfterLogout(refreshResult.refreshToken);
  } else if (loginResult?.session?.accessToken) {
    await testLogout(loginResult.session.accessToken);
    await testRefreshAfterLogout(loginResult.session.refreshToken);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Tests completed!\n');
}

main().catch(console.error);

