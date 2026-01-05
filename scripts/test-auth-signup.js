/**
 * Test Script: Auth Signup API
 * 
 * Usage: node scripts/test-auth-signup.js
 * 
 * Prerequisites:
 * - Auth service running on port 3001
 * - PostgreSQL running (docker-compose)
 * - Redis running (docker-compose)
 */

const http = require('http');

const AUTH_BASE_URL = 'http://localhost:3000';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, AUTH_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
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

async function testSignup() {
  console.log('🧪 Testing Auth Signup API\n');
  console.log('=' .repeat(50));

  // Test 1: Successful signup
  console.log('\n📝 Test 1: Successful signup');
  const timestamp = Date.now();
  const signupData = {
    email: `test${timestamp}@example.com`,
    password: 'SecurePass123!',
    role: 'user',
    displayName: 'Test User',
    primaryPhone: '+1234567890',
    companyName: 'Test Company',
    companyRepresentativeName: 'John Doe',
    companyBillingAddress: '123 Test St, City',
    preferredLanguage: 'en',
    acceptTerms: true,
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/signup', signupData);
    
    if (response.status === 201) {
      console.log('✅ Signup successful!');
      console.log('   User ID:', response.data.userId);
      console.log('   Email:', response.data.email);
      console.log('   Role:', response.data.role);
      console.log('   KYC State:', response.data.kyc?.state);
      console.log('   Access Token:', response.data.session?.accessToken?.substring(0, 50) + '...');
      console.log('   Refresh Token:', response.data.session?.refreshToken?.substring(0, 50) + '...');
      
      // Save tokens for other tests
      return response.data;
    } else {
      console.log('❌ Signup failed!');
      console.log('   Status:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return null;
  }
}

async function testDuplicateEmail(email) {
  console.log('\n📝 Test 2: Duplicate email rejection');
  
  const signupData = {
    email,
    password: 'SecurePass123!',
    role: 'user',
    acceptTerms: true,
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/signup', signupData);
    
    if (response.status === 409) {
      console.log('✅ Correctly rejected duplicate email!');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 409 Conflict, got:', response.status);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function testWeakPassword() {
  console.log('\n📝 Test 3: Weak password rejection');
  
  const signupData = {
    email: `test${Date.now()}@example.com`,
    password: 'weak',
    role: 'user',
    acceptTerms: true,
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/signup', signupData);
    
    if (response.status === 400) {
      console.log('✅ Correctly rejected weak password!');
      console.log('   Error:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ Expected 400 Bad Request, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function testTermsNotAccepted() {
  console.log('\n📝 Test 4: Terms not accepted rejection');
  
  const signupData = {
    email: `test${Date.now()}@example.com`,
    password: 'SecurePass123!',
    role: 'user',
    acceptTerms: false,
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/signup', signupData);
    
    if (response.status === 400) {
      console.log('✅ Correctly rejected - terms not accepted!');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 400 Bad Request, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Auth Service Signup Tests\n');
  console.log('Make sure the auth service is running: npm run auth:dev');
  console.log('=' .repeat(50));

  // Run tests
  const result = await testSignup();
  
  if (result) {
    await testDuplicateEmail(result.email);
  }
  
  await testWeakPassword();
  await testTermsNotAccepted();

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Tests completed!\n');
}

main().catch(console.error);

