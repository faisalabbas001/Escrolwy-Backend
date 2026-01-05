/**
 * Test Script: Inquiry Service APIs
 * 
 * Usage: node scripts/test-inquiry.js
 * 
 * Prerequisites:
 * - PostgreSQL running (docker-compose up postgres)
 * - Kafka/Redpanda running (docker-compose --profile dev up redpanda)
 * - Inquiry service running on port 3003
 * 
 * This script tests the complete inquiry workflow including:
 * - Health check
 * - Create inquiry
 * - Get inquiry by ID
 * - Add messages
 * - Add attachments
 * - Admin operations (list, assign, resolve)
 * - Outbox event verification
 */

const http = require('http');

const INQUIRY_BASE_URL = 'http://localhost:3003';

// Store test data for cleanup
let createdInquiryId = null;
let createdMessageId = null;

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, INQUIRY_BASE_URL);
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

// ==========================================
// HEALTH CHECK TESTS
// ==========================================

async function testHealth() {
  console.log('\n📝 Test: Health check');
  try {
    const response = await makeRequest('GET', '/api/v1/health');
    if (response.status === 200) {
      console.log('✅ Inquiry service is healthy');
      console.log('   Service:', response.data.service || 'inquiry-service');
      console.log('   Status:', response.data.status || 'ok');
      if (response.data.kafka) {
        console.log('   Kafka:', response.data.kafka.status);
      }
      if (response.data.database) {
        console.log('   Database:', response.data.database.status);
      }
      return true;
    } else {
      console.log('❌ Health check failed:', response.status);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    console.log('   Make sure the inquiry service is running on port 3003');
    return false;
  }
}

// ==========================================
// INQUIRY CRUD TESTS
// ==========================================

// Generate a random UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function testCreateInquiry() {
  console.log('\n📝 Test: Create inquiry');
  const createData = {
    escrow_id: `escrow-test-${Date.now()}`,
    created_by: generateUUID(), // Must be a UUID
    initial_message: 'This is a test inquiry message for testing the new outbox pattern.',
  };

  try {
    const response = await makeRequest('POST', '/api/v1/inquiries', createData);
    if (response.status === 201) {
      console.log('✅ Inquiry created successfully');
      console.log('   Inquiry ID:', response.data.id);
      console.log('   Escrow ID:', response.data.escrow_id);
      console.log('   Status:', response.data.status);
      createdInquiryId = response.data.id;
      return response.data;
    } else {
      console.log('❌ Create inquiry failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Create inquiry failed:', error.message);
    return null;
  }
}

async function testGetInquiry() {
  console.log('\n📝 Test: Get inquiry by ID');
  if (!createdInquiryId) {
    console.log('⚠️ Skipping - no inquiry created');
    return null;
  }

  try {
    const response = await makeRequest('GET', `/api/v1/inquiries/${createdInquiryId}`);
    if (response.status === 200) {
      console.log('✅ Inquiry retrieved successfully');
      console.log('   Inquiry ID:', response.data.id);
      console.log('   Escrow ID:', response.data.escrow_id);
      console.log('   Status:', response.data.status);
      console.log('   Messages:', response.data.messages?.length || 0);
      return response.data;
    } else {
      console.log('❌ Get inquiry failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Get inquiry failed:', error.message);
    return null;
  }
}

async function testGetInquiryByEscrow(escrowId) {
  console.log('\n📝 Test: Get inquiry by escrow ID');
  if (!escrowId) {
    console.log('⚠️ Skipping - no escrow ID');
    return null;
  }

  try {
    const response = await makeRequest('GET', `/api/v1/inquiries/escrow/${escrowId}`);
    if (response.status === 200) {
      console.log('✅ Inquiry retrieved by escrow ID');
      console.log('   Inquiry ID:', response.data.id);
      return response.data;
    } else {
      console.log('❌ Get inquiry by escrow failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ Get inquiry by escrow failed:', error.message);
    return null;
  }
}

// ==========================================
// MESSAGE TESTS
// ==========================================

async function testAddMessage() {
  console.log('\n📝 Test: Add message to inquiry');
  if (!createdInquiryId) {
    console.log('⚠️ Skipping - no inquiry created');
    return null;
  }

  const messageData = {
    sender_id: generateUUID(), // Must be a UUID
    sender_role: 'seller',
    message: 'This is a reply from the seller - testing outbox pattern.',
  };

  try {
    const response = await makeRequest('POST', `/api/v1/inquiries/${createdInquiryId}/messages`, messageData);
    if (response.status === 201) {
      console.log('✅ Message added successfully');
      console.log('   Message ID:', response.data.id);
      console.log('   Sender Role:', response.data.sender_role);
      createdMessageId = response.data.id;
      return response.data;
    } else {
      console.log('❌ Add message failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Add message failed:', error.message);
    return null;
  }
}

async function testGetMessages() {
  console.log('\n📝 Test: Get messages for inquiry');
  if (!createdInquiryId) {
    console.log('⚠️ Skipping - no inquiry created');
    return null;
  }

  try {
    const response = await makeRequest('GET', `/api/v1/inquiries/${createdInquiryId}/messages?page=1&limit=10`);
    if (response.status === 200) {
      console.log('✅ Messages retrieved successfully');
      console.log('   Total messages:', response.data.total);
      console.log('   Page:', response.data.page);
      return response.data;
    } else {
      console.log('❌ Get messages failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ Get messages failed:', error.message);
    return null;
  }
}

// ==========================================
// ATTACHMENT TESTS
// ==========================================

async function testAddAttachment() {
  console.log('\n📝 Test: Add attachment to inquiry');
  if (!createdInquiryId || !createdMessageId) {
    console.log('⚠️ Skipping - no inquiry or message created');
    return null;
  }

  const attachmentData = {
    message_id: createdMessageId,
    file_url: 'https://example.com/test-file.pdf',
    file_type: 'pdf', // Must be one of: pdf, image, document, spreadsheet, other
  };

  try {
    const response = await makeRequest('POST', `/api/v1/inquiries/${createdInquiryId}/attachments`, attachmentData);
    if (response.status === 201) {
      console.log('✅ Attachment added successfully');
      console.log('   Attachment ID:', response.data.id);
      console.log('   File Type:', response.data.file_type);
      return response.data;
    } else {
      console.log('❌ Add attachment failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Add attachment failed:', error.message);
    return null;
  }
}

async function testGetAttachments() {
  console.log('\n📝 Test: Get attachments for inquiry');
  if (!createdInquiryId) {
    console.log('⚠️ Skipping - no inquiry created');
    return null;
  }

  try {
    const response = await makeRequest('GET', `/api/v1/inquiries/${createdInquiryId}/attachments?page=1&limit=10`);
    if (response.status === 200) {
      console.log('✅ Attachments retrieved successfully');
      console.log('   Total attachments:', response.data.total);
      return response.data;
    } else {
      console.log('❌ Get attachments failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('❌ Get attachments failed:', error.message);
    return null;
  }
}

// ==========================================
// ADMIN TESTS
// ==========================================

async function testAdminListInquiries() {
  console.log('\n📝 Test: Admin - List inquiries');
  try {
    const response = await makeRequest('GET', '/api/v1/inquiries/admin/inquiries?page=1&limit=10');
    if (response.status === 200) {
      console.log('✅ Admin list inquiries successful');
      console.log('   Total inquiries:', response.data.total);
      console.log('   Page:', response.data.page);
      return response.data;
    } else {
      console.log('❌ Admin list inquiries failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Admin list inquiries failed:', error.message);
    return null;
  }
}

async function testAdminAssignInquiry() {
  console.log('\n📝 Test: Admin - Assign inquiry');
  if (!createdInquiryId) {
    console.log('⚠️ Skipping - no inquiry created');
    return null;
  }

  const assignData = {
    admin_id: generateUUID(), // Must be a UUID
  };

  try {
    const response = await makeRequest('POST', `/api/v1/inquiries/admin/inquiries/${createdInquiryId}/assign`, assignData);
    if (response.status === 200) {
      console.log('✅ Inquiry assigned successfully');
      console.log('   Assigned Admin ID:', response.data.assigned_admin_id);
      return response.data;
    } else {
      console.log('❌ Assign inquiry failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Assign inquiry failed:', error.message);
    return null;
  }
}

async function testAdminResolveInquiry() {
  console.log('\n📝 Test: Admin - Resolve inquiry');
  if (!createdInquiryId) {
    console.log('⚠️ Skipping - no inquiry created');
    return null;
  }

  const resolveData = {
    status: 'closed',
    resolution_note: 'Test inquiry resolved successfully - outbox pattern working!',
  };

  try {
    const response = await makeRequest('POST', `/api/v1/inquiries/admin/inquiries/${createdInquiryId}/resolve`, resolveData);
    if (response.status === 200) {
      console.log('✅ Inquiry resolved successfully');
      console.log('   Status:', response.data.status);
      return response.data;
    } else {
      console.log('❌ Resolve inquiry failed:', response.status);
      console.log('   Error:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Resolve inquiry failed:', error.message);
    return null;
  }
}

// ==========================================
// CONFLICT & ERROR TESTS
// ==========================================

async function testDuplicateInquiry(escrowId) {
  console.log('\n📝 Test: Create duplicate inquiry (should fail)');
  if (!escrowId) {
    console.log('⚠️ Skipping - no escrow ID');
    return;
  }

  const createData = {
    escrow_id: escrowId,
    created_by: generateUUID(), // Must be a UUID
  };

  try {
    const response = await makeRequest('POST', '/api/v1/inquiries', createData);
    if (response.status === 409) {
      console.log('✅ Correctly rejected duplicate inquiry');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 409, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function testNotFoundInquiry() {
  console.log('\n📝 Test: Get non-existent inquiry (should fail)');
  try {
    const response = await makeRequest('GET', '/api/v1/inquiries/non-existent-id-12345');
    if (response.status === 404) {
      console.log('✅ Correctly returned 404');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 404, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function testCloseAlreadyClosedInquiry() {
  console.log('\n📝 Test: Close already closed inquiry (should fail)');
  if (!createdInquiryId) {
    console.log('⚠️ Skipping - no inquiry created');
    return;
  }

  const closeData = {
    status: 'closed',
    note: 'Trying to close again',
  };

  try {
    const response = await makeRequest('POST', `/api/v1/inquiries/${createdInquiryId}/close`, closeData);
    if (response.status === 400) {
      console.log('✅ Correctly rejected closing already closed inquiry');
      console.log('   Error:', response.data.message);
    } else {
      console.log('❌ Expected 400, got:', response.status);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// ==========================================
// MAIN TEST RUNNER
// ==========================================

async function main() {
  console.log('🚀 Inquiry Service Tests\n');
  console.log('=' .repeat(60));
  console.log('Testing the Inquiry Service with new Kafka Outbox Pattern');
  console.log('');
  console.log('Make sure the following are running:');
  console.log('  1. PostgreSQL: docker-compose up -d postgres');
  console.log('  2. Redpanda (optional): docker-compose --profile dev up -d redpanda');
  console.log('  3. Inquiry Service: cd services/inquiry && npm run start:dev');
  console.log('');
  console.log('Service URL:', INQUIRY_BASE_URL);
  console.log('=' .repeat(60));

  // Health check
  const healthy = await testHealth();
  if (!healthy) {
    console.log('\n❌ Service not healthy. Aborting tests.');
    console.log('\nTo start the service:');
    console.log('  cd services/inquiry');
    console.log('  npm install');
    console.log('  npx prisma generate');
    console.log('  npx prisma migrate deploy');
    console.log('  npm run start:dev');
    return;
  }

  // Create inquiry
  const inquiry = await testCreateInquiry();
  
  if (inquiry) {
    // Get inquiry tests
    await testGetInquiry();
    await testGetInquiryByEscrow(inquiry.escrow_id);
    
    // Message tests
    await testAddMessage();
    await testGetMessages();
    
    // Attachment tests
    await testAddAttachment();
    await testGetAttachments();
    
    // Admin tests
    await testAdminListInquiries();
    await testAdminAssignInquiry();
    await testAdminResolveInquiry();
    
    // Error handling tests
    await testDuplicateInquiry(inquiry.escrow_id);
    await testNotFoundInquiry();
    await testCloseAlreadyClosedInquiry();
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Inquiry Service Tests completed!\n');
  
  console.log('\n📊 To verify outbox events in the database:');
  console.log('   psql -h localhost -p 5433 -U escrowly_dev -d escrowly');
  console.log('   SELECT id, topic, status, "createdAt", "publishedAt" FROM inquiry_db.outbox_events ORDER BY "createdAt" DESC;');
  
  console.log('\n📨 To check Kafka events (if Kafka is enabled):');
  console.log('   Open Kafka UI: http://localhost:8080');
  console.log('   Check topics: inquiry.created, inquiry.message.added, etc.');
}

main().catch(console.error);
