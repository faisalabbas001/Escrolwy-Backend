# Testing Guide - BFF Inquiry Service Integration

> **Complete guide for testing the Inquiry Service integration in BFF**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Starting Services](#starting-services)
3. [Testing Setup](#testing-setup)
4. [Manual Testing with cURL](#manual-testing-with-curl)
5. [Testing with Postman/Insomnia](#testing-with-postmaninsomnia)
6. [Verifying Swagger Documentation](#verifying-swagger-documentation)
7. [Test Scenarios](#test-scenarios)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

1. **PostgreSQL** - Database (via docker compose)
2. **Redis** - Session storage (via docker compose)
3. **Auth Service** - Port 3000 (must be running)
4. **Admin Service** - Port 3002 (optional, for other features)
5. **Inquiry Service** - Port 3003 (must be running)
6. **BFF Service** - Port 3001 (the service we're testing)

### Required Environment Variables

#### Getting JWT_SECRET

The `JWT_SECRET` is used to sign and verify JWT tokens. **All services (BFF, Auth, Admin, Inquiry) must use the same JWT_SECRET**.

**Option 1: Using .env file (Recommended for Local Development)**

Create a `.env` file in the **project root** (`escrowly-backend/.env`):

```bash
# From project root
cat > .env << 'EOF'
# JWT Secret (use a strong random string in production!)
JWT_SECRET=dev_jwt_secret_key_change_in_production_min_32_characters

# Other environment variables (if needed)
FRONTEND_URL=http://localhost:5173
EOF
```

Docker Compose will automatically read this `.env` file.

**Option 2: Export as Environment Variable**

```bash
# Export before running docker compose
export JWT_SECRET="dev_jwt_secret_key_change_in_production_min_32_characters"
docker compose up -d
```

**Option 3: Use Default (Only for Quick Testing)**

If you don't set `JWT_SECRET`, docker compose uses a default:
```
dummy_jwt_secret_change_after_deployment
```

⚠️ **Warning**: The default value is insecure - only use for quick testing!

**Generate a Secure JWT Secret**:

```bash
# Generate a random secret (32+ characters recommended)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or
openssl rand -hex 32
```

**For docker compose**, the JWT_SECRET is configured in `docker compose.yml`:
```yaml
JWT_SECRET: ${JWT_SECRET:-dummy_jwt_secret_change_after_deployment}
```

This reads from your `.env` file or uses the default.

#### Environment Variables Summary

**For Local Development** (`.env` file in project root):
```env
# Required
JWT_SECRET=your_secure_secret_here_min_32_chars

# Optional
FRONTEND_URL=http://localhost:5173
```

**Note**: Docker Compose automatically reads `.env` from the project root, so you don't need to set environment variables for each service individually - they all use the same `JWT_SECRET` from the root `.env` file.

---

## Starting Services

### Option 1: Docker Compose (Recommended)

**Note**: Use `docker compose` (space) not `docker compose` (hyphen). Modern Docker includes Compose as a plugin.

```bash
# From project root
cd /home/weiblocks/Downloads/escrowly-backend

# Start all services
docker compose up -d

# View logs
docker compose logs -f bff-service
docker compose logs -f inquiry-service
docker compose logs -f auth-service

# Check if services are running
docker compose ps

# Stop services
docker compose down

# Restart a specific service
docker compose restart bff-service
```

### Option 2: Local Development

```bash
# Terminal 1: Start Auth Service
cd services/auth
npm run start:dev

# Terminal 2: Start Inquiry Service
cd services/inquiry
npm run start:dev

# Terminal 3: Start BFF Service
cd services/bff
npm run start:dev
```

### Verify Services Are Running

```bash
# Check BFF
curl http://localhost:3001/api/v1/health

# Check Auth Service
curl http://localhost:3000/api/v1/health

# Check Inquiry Service
curl http://localhost:3003/api/v1/health
```

---

## Testing Setup

### Step 1: Get Authentication Token

First, you need a JWT token to test protected endpoints.

```bash
# Register a new user (or use existing)
curl -X POST http://localhost:3001/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "fullName": "Test User"
  }'

# Login to get JWT token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

**Response**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": { ... }
}
```

**Save the token**:
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Step 2: Verify Token Works

```bash
# Test getting current user (this validates BFF JWT validation)
curl -X GET http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Manual Testing with cURL

### User Endpoints

#### 1. Create Inquiry

```bash
curl -X POST http://localhost:3001/api/v1/inquiries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "escrow_id": "550e8400-e29b-41d4-a716-446655440000",
    "subject": "Payment Issue"
  }'
```

**Expected Response** (201):
```json
{
  "id": "...",
  "escrow_id": "550e8400-e29b-41d4-a716-446655440000",
  "subject": "Payment Issue",
  "status": "open",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Save inquiry ID**:
```bash
export INQUIRY_ID="..."
```

#### 2. Get Inquiry by ID

```bash
curl -X GET http://localhost:3001/api/v1/inquiries/$INQUIRY_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (200):
```json
{
  "id": "...",
  "escrow_id": "...",
  "subject": "Payment Issue",
  "status": "open",
  "messages": [...],
  "attachments": [...]
}
```

#### 3. Get Inquiry by Escrow ID

```bash
curl -X GET http://localhost:3001/api/v1/inquiries/escrow/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Add Message to Inquiry

```bash
curl -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "user-id-here",
    "sender_role": "buyer",
    "message": "Hello, I need help with my payment"
  }'
```

**Save message ID**:
```bash
export MESSAGE_ID="..."
```

#### 5. Get Messages (Paginated)

```bash
# Get first page
curl -X GET "http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/messages?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Get second page
curl -X GET "http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/messages?page=2&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Add Attachment

```bash
curl -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_id": "'$MESSAGE_ID'",
    "file_url": "https://example.com/file.pdf",
    "file_type": "application/pdf"
  }'
```

#### 7. Upload File and Create Attachment

```bash
curl -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/attachments/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/file.pdf" \
  -F "message_id=$MESSAGE_ID"
```

#### 8. Get Attachments

```bash
curl -X GET "http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/attachments?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

#### 9. Close Inquiry

```bash
curl -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "closed"
  }'
```

### Admin Endpoints

#### 10. List All Inquiries (Admin)

```bash
# Get all inquiries
curl -X GET "http://localhost:3001/api/v1/admin/inquiries?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Filter by status
curl -X GET "http://localhost:3001/api/v1/admin/inquiries?status=open&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Filter by assigned admin
curl -X GET "http://localhost:3001/api/v1/admin/inquiries?assignedAdminId=admin-id-here&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

#### 11. Get Inquiry Detail (Admin)

```bash
curl -X GET http://localhost:3001/api/v1/admin/inquiries/$INQUIRY_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### 12. Assign Inquiry to Admin

```bash
curl -X POST http://localhost:3001/api/v1/admin/inquiries/$INQUIRY_ID/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_id": "admin-user-id-here"
  }'
```

#### 13. Resolve Inquiry

```bash
curl -X POST http://localhost:3001/api/v1/admin/inquiries/$INQUIRY_ID/resolve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution_notes": "Issue resolved successfully"
  }'
```

---

## Testing with Postman/Insomnia

### Setup Postman Collection

1. **Create Environment**:
   - `base_url`: `http://localhost:3001/api/v1`
   - `token`: `{{your_jwt_token}}`
   - `inquiry_id`: `{{inquiry_id}}`
   - `message_id`: `{{message_id}}`

2. **Authentication**:
   - Create a request: `POST {{base_url}}/auth/login`
   - Save `accessToken` from response to `token` variable

3. **Use Authorization Header**:
   - In each request, add header: `Authorization: Bearer {{token}}`

### Test Collection Structure

```
BFF Inquiry Service Tests
├── Authentication
│   ├── Login
│   └── Get Current User
├── User Endpoints
│   ├── Create Inquiry
│   ├── Get Inquiry by ID
│   ├── Get Inquiry by Escrow ID
│   ├── Add Message
│   ├── Get Messages
│   ├── Upload File & Create Attachment
│   ├── Get Attachments
│   └── Close Inquiry
└── Admin Endpoints
    ├── List Inquiries
    ├── Get Inquiry Detail (Admin)
    ├── Assign Inquiry
    └── Resolve Inquiry
```

---

## Verifying Swagger Documentation

### Access Swagger UI

```bash
# Open in browser
open http://localhost:3001/api/docs
# or
xdg-open http://localhost:3001/api/docs
```

### Verify Tags

Check that these tags are present:
- ✅ `inquiries` - User inquiry endpoints
- ✅ `admin/inquiries` - Admin inquiry endpoints

### Test from Swagger UI

1. Click "Authorize" button
2. Enter your JWT token: `Bearer <your-token>`
3. Test endpoints directly from Swagger UI
4. Verify request/response schemas

---

## Test Scenarios

### Scenario 1: Happy Path - Create and Manage Inquiry

```bash
# 1. Create inquiry
INQUIRY_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/inquiries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"escrow_id": "test-escrow-123", "subject": "Test Inquiry"}')

INQUIRY_ID=$(echo $INQUIRY_RESPONSE | jq -r '.id')
echo "Created inquiry: $INQUIRY_ID"

# 2. Add message
MESSAGE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sender_id": "user-123", "sender_role": "buyer", "message": "Test message"}')

MESSAGE_ID=$(echo $MESSAGE_RESPONSE | jq -r '.id')
echo "Created message: $MESSAGE_ID"

# 3. Get messages
curl -s -X GET "http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/messages" \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Close inquiry
curl -s -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}' | jq
```

### Scenario 2: Error Cases

#### Missing Token
```bash
# Should return 401 Unauthorized
curl -X GET http://localhost:3001/api/v1/inquiries/some-id
```

**Expected Response** (401):
```json
{
  "statusCode": 401,
  "message": "No authentication token provided",
  "error": "Unauthorized"
}
```

#### Invalid Token
```bash
# Should return 401 Unauthorized
curl -X GET http://localhost:3001/api/v1/inquiries/some-id \
  -H "Authorization: Bearer invalid-token"
```

#### Invalid Inquiry ID
```bash
# Should return 404 Not Found
curl -X GET http://localhost:3001/api/v1/inquiries/invalid-uuid \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (404):
```json
{
  "statusCode": 404,
  "message": "Inquiry not found",
  "error": "Not Found"
}
```

### Scenario 3: Query Parameters

```bash
# Test pagination
curl -X GET "http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/messages?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Test filtering (admin)
curl -X GET "http://localhost:3001/api/v1/admin/inquiries?status=open&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Scenario 4: File Upload

```bash
# Create a test file
echo "Test file content" > test-file.txt

# Upload file
curl -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/attachments/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-file.txt" \
  -F "message_id=$MESSAGE_ID"
```

---

## Testing Checklist

### ✅ Basic Functionality

- [ ] Health check endpoint works
- [ ] Authentication works (login, get current user)
- [ ] Can create inquiry
- [ ] Can get inquiry by ID
- [ ] Can get inquiry by escrow ID
- [ ] Can add message
- [ ] Can get messages (paginated)
- [ ] Can upload file and create attachment
- [ ] Can get attachments
- [ ] Can close inquiry

### ✅ Admin Endpoints

- [ ] Can list all inquiries (admin)
- [ ] Can filter inquiries by status
- [ ] Can filter inquiries by assigned admin
- [ ] Can get inquiry detail (admin)
- [ ] Can assign inquiry to admin
- [ ] Can resolve inquiry

### ✅ Error Handling

- [ ] Missing token returns 401
- [ ] Invalid token returns 401
- [ ] Expired token returns 401
- [ ] Invalid inquiry ID returns 404
- [ ] Invalid request body returns 400
- [ ] Backend service errors are forwarded correctly

### ✅ Query Parameters

- [ ] Pagination works (page, limit)
- [ ] Filtering works (status, assignedAdminId)
- [ ] Multiple query parameters work together

### ✅ Swagger Documentation

- [ ] Swagger UI is accessible
- [ ] All endpoints are documented
- [ ] Request/response schemas are correct
- [ ] Can test endpoints from Swagger UI
- [ ] Authorization works in Swagger UI

---

## Troubleshooting

### Issue: Connection Refused

**Symptom**: `curl: (7) Failed to connect to localhost port 3001`

**Solutions**:
```bash
# Check if BFF service is running
docker compose ps bff-service

# Check BFF logs
docker compose logs bff-service

# Start BFF service
docker compose up -d bff-service

# Or if running locally
cd services/bff
npm run start:dev
```

### Issue: 502 Bad Gateway

**Symptom**: `502 Bad Gateway` when calling BFF endpoints

**Cause**: Inquiry Service is not running or not accessible

**Solutions**:
```bash
# Check if Inquiry Service is running
docker compose ps inquiry-service

# Check Inquiry Service logs
docker compose logs inquiry-service

# Verify INQUIRY_SERVICE_URL in BFF
docker compose exec bff-service env | grep INQUIRY_SERVICE_URL

# Start Inquiry Service
docker compose up -d inquiry-service
```

### Issue: 401 Unauthorized

**Symptom**: `401 Unauthorized` even with valid token

**Possible Causes**:
1. Token expired
2. JWT_SECRET mismatch between BFF and Inquiry Service
3. Token format incorrect

**Solutions**:
```bash
# Check JWT_SECRET matches
docker compose exec bff-service env | grep JWT_SECRET
docker compose exec inquiry-service env | grep JWT_SECRET

# Get new token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!@#"}'

# Verify token format
echo $TOKEN | cut -d'.' -f1,2,3  # Should have 3 parts
```

### Issue: 404 Not Found

**Symptom**: `404 Not Found` for valid endpoints

**Possible Causes**:
1. Wrong URL path
2. Missing API version
3. Route not registered

**Solutions**:
```bash
# Verify route is correct
# Should be: /api/v1/inquiries/... (not /inquiries/...)

# Check if route is registered
curl http://localhost:3001/api/docs  # Check Swagger UI

# Check BFF logs for route registration
docker compose logs bff-service | grep "inquiries"
```

### Issue: Request Body Not Received

**Symptom**: Backend service receives empty body

**Solutions**:
```bash
# Verify Content-Type header
curl -X POST http://localhost:3001/api/v1/inquiries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \  # ← Important!
  -d '{"escrow_id": "...", "subject": "..."}'

# Check BFF logs
docker compose logs bff-service | grep "POST"
```

### Issue: File Upload Fails

**Symptom**: File upload returns error

**Solutions**:
```bash
# Verify file exists
ls -lh /path/to/file.pdf

# Check file size (should be < 10MB)
du -h /path/to/file.pdf

# Verify Content-Type is multipart/form-data (automatic with -F flag)
curl -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/attachments/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "message_id=$MESSAGE_ID"

# Check BFF logs
docker compose logs bff-service | grep "upload"
```

---

## Quick Test Script

Save this as `test-inquiry-integration.sh`:

```bash
#!/bin/bash

# Configuration
BFF_URL="http://localhost:3001/api/v1"
EMAIL="test@example.com"
PASSWORD="Test123!@#"

echo "🔐 Step 1: Login to get token..."
LOGIN_RESPONSE=$(curl -s -X POST $BFF_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo $LOGIN_RESPONSE | jq
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

echo ""
echo "📝 Step 2: Create inquiry..."
INQUIRY_RESPONSE=$(curl -s -X POST $BFF_URL/inquiries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"escrow_id": "test-escrow-'$(date +%s)'", "subject": "Test Inquiry"}')

INQUIRY_ID=$(echo $INQUIRY_RESPONSE | jq -r '.id')

if [ "$INQUIRY_ID" == "null" ] || [ -z "$INQUIRY_ID" ]; then
  echo "❌ Failed to create inquiry!"
  echo $INQUIRY_RESPONSE | jq
  exit 1
fi

echo "✅ Inquiry created: $INQUIRY_ID"

echo ""
echo "📨 Step 3: Add message..."
MESSAGE_RESPONSE=$(curl -s -X POST $BFF_URL/inquiries/$INQUIRY_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sender_id": "test-user", "sender_role": "buyer", "message": "Test message"}')

MESSAGE_ID=$(echo $MESSAGE_RESPONSE | jq -r '.id')

if [ "$MESSAGE_ID" == "null" ] || [ -z "$MESSAGE_ID" ]; then
  echo "❌ Failed to add message!"
  echo $MESSAGE_RESPONSE | jq
  exit 1
fi

echo "✅ Message added: $MESSAGE_ID"

echo ""
echo "📋 Step 4: Get messages..."
curl -s -X GET "$BFF_URL/inquiries/$INQUIRY_ID/messages" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length' | xargs -I {} echo "✅ Found {} messages"

echo ""
echo "✅ All tests passed!"
echo "   Inquiry ID: $INQUIRY_ID"
echo "   Message ID: $MESSAGE_ID"
```

Make it executable and run:
```bash
chmod +x test-inquiry-integration.sh
./test-inquiry-integration.sh
```

---

## Integration Test Example (Jest)

Create `test/inquiry.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Inquiry Integration (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let inquiryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Test123!@#' });

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create inquiry', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inquiries')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        escrow_id: 'test-escrow-123',
        subject: 'Test Inquiry',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.escrow_id).toBe('test-escrow-123');
    inquiryId = response.body.id;
  });

  it('should get inquiry by ID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/inquiries/${inquiryId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.id).toBe(inquiryId);
  });

  it('should add message to inquiry', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/inquiries/${inquiryId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sender_id: 'test-user',
        sender_role: 'buyer',
        message: 'Test message',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  });

  it('should return 401 without token', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/inquiries/${inquiryId}`)
      .expect(401);
  });
});
```

---

## Summary

This testing guide covers:

1. ✅ **Prerequisites** - What services need to be running
2. ✅ **Starting Services** - Docker Compose or local
3. ✅ **Manual Testing** - cURL commands for all endpoints
4. ✅ **Postman/Insomnia** - Collection structure
5. ✅ **Swagger** - Verification steps
6. ✅ **Test Scenarios** - Happy path, error cases, edge cases
7. ✅ **Troubleshooting** - Common issues and solutions
8. ✅ **Quick Test Script** - Automated basic testing
9. ✅ **Integration Tests** - Jest e2e example

**Next Steps**:
1. Start all services
2. Run the quick test script
3. Test individual endpoints
4. Verify Swagger documentation
5. Run integration tests

---

**Last Updated**: 2024

