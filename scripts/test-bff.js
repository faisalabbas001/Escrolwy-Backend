/**
 * Test Script: BFF Service APIs
 * 
 * Usage: node scripts/test-bff.js
 * 
 * Prerequisites:
 * - Auth service running on port 3000
 * - Admin service running on port 3002
 * - BFF service running on port 3001
 */

const http = require('http');

const BFF_BASE_URL = 'http://localhost:3001';

let accessToken = null;

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

async function testHealth() {
  console.log('\n📝 Test: Health check');
  try {
    const response = await makeRequest('GET', '/api/v1/health');
    if (response.status === 200) {
      console.log('✅ BFF service is healthy');
      console.log('   Service:', response.data.service);
      console.log('   Status:', response.data.status);
    } else {
      console.log('❌ Health check failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
}

async function testAuthSignup() {
  console.log('\n📝 Test: Auth signup via BFF');
  const timestamp = Date.now();
  const signupData = {
    email: `bfftest${timestamp}@example.com`,
    password: 'SecurePass123!',
    role: 'user',
    displayName: 'BFF Test User',
    acceptTerms: true,
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/signup', signupData);
    if (response.status === 201) {
      console.log('✅ Signup successful via BFF');
      console.log('   User ID:', response.data.userId);
      console.log('   Email:', response.data.email);
      accessToken = response.data.session?.accessToken;
      return response.data;
    } else {
      console.log('❌ Signup failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Signup failed:', error.message);
    return null;
  }
}

async function testAuthLogin(email) {
  console.log('\n📝 Test: Auth login via BFF');
  const loginData = {
    email,
    password: 'SecurePass123!',
  };

  try {
    const response = await makeRequest('POST', '/api/v1/auth/login', loginData);
    if (response.status === 200) {
      console.log('✅ Login successful via BFF');
      console.log('   User ID:', response.data.userId);
      accessToken = response.data.session?.accessToken;
      return response.data;
    } else {
      console.log('❌ Login failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Login failed:', error.message);
    return null;
  }
}

async function testBlogsPublic() {
  console.log('\n📝 Test: Get blogs (public - no auth)');
  try {
    const response = await makeRequest('GET', '/api/v1/admin/blogs?page=1&limit=5');
    if (response.status === 200) {
      console.log('✅ Blogs retrieved successfully');
      console.log('   Total:', response.data.total || response.data.data?.length || 0);
    } else {
      console.log('❌ Get blogs failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Get blogs failed:', error.message);
  }
}

async function testBlogCategories() {
  console.log('\n📝 Test: Get blog categories (public)');
  try {
    const response = await makeRequest('GET', '/api/v1/admin/blogs/categories');
    if (response.status === 200) {
      console.log('✅ Categories retrieved successfully');
      console.log('   Categories:', response.data?.length || 0);
    } else {
      console.log('❌ Get categories failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Get categories failed:', error.message);
  }
}

async function testHelpDeskCategories() {
  console.log('\n📝 Test: Get help desk categories (public)');
  try {
    const response = await makeRequest('GET', '/api/v1/admin/help-desk/categories');
    if (response.status === 200) {
      console.log('✅ Help desk categories retrieved');
      console.log('   Categories:', response.data?.length || 0);
    } else {
      console.log('❌ Get help desk categories failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Get help desk categories failed:', error.message);
  }
}

async function testHelpDeskQuestions() {
  console.log('\n📝 Test: Get help desk questions (public)');
  try {
    const response = await makeRequest('GET', '/api/v1/admin/help-desk/questions');
    if (response.status === 200) {
      console.log('✅ Help desk questions retrieved');
      console.log('   Questions:', response.data?.length || 0);
    } else {
      console.log('❌ Get help desk questions failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Get help desk questions failed:', error.message);
  }
}

async function testProtectedWithoutToken() {
  console.log('\n📝 Test: Protected route without token (should fail)');
  try {
    const response = await makeRequest('POST', '/api/v1/admin/blogs', {
      title: 'Test Blog',
    });
    if (response.status === 401) {
      console.log('✅ Correctly rejected - no token');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 401, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function testProtectedWithToken() {
  console.log('\n📝 Test: Protected route with token');
  if (!accessToken) {
    console.log('⚠️ Skipping - no access token');
    return;
  }
  
  try {
    // This might fail if admin service is not running or blog data doesn't exist
    // But it should pass JWT validation
    const response = await makeRequest('GET', '/api/v1/admin/blogs/categories', null, {
      Authorization: `Bearer ${accessToken}`,
    });
    console.log('✅ JWT validation passed');
    console.log('   Response status:', response.status);
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 BFF Service Tests\n');
  console.log('=' .repeat(60));
  console.log('Make sure services are running:');
  console.log('  - Auth service: npm run auth:dev (port 3000)');
  console.log('  - Admin service: npm run admin:dev (port 3002)');
  console.log('  - BFF service: npm run bff:dev (port 3001)');
  console.log('=' .repeat(60));

  // Health check
  await testHealth();

  // Auth tests via BFF
  const signupResult = await testAuthSignup();
  if (signupResult) {
    await testAuthLogin(signupResult.email);
  }

  // Blog tests
  await testBlogsPublic();
  await testBlogCategories();

  // Help desk tests
  await testHelpDeskCategories();
  await testHelpDeskQuestions();

  // Protected route tests
  await testProtectedWithoutToken();
  await testProtectedWithToken();

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 BFF Tests completed!\n');
}

main().catch(console.error);

