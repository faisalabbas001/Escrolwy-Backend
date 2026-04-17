# Escrowly Backend - Postman Collection Guide

## 📦 Overview

This directory contains a comprehensive Postman collection for testing all Escrowly backend microservices through the BFF (Backend for Frontend) gateway.

**What's Included:**
- Complete API collection with 75+ endpoints
- Pre-configured environment for local development
- Automatic JWT token management and refresh
- End-to-end workflow examples
- Test scripts for validation and data extraction

## 🚀 Quick Start

### 1. Import Collection and Environment

**Option A: Using Postman Desktop App**
1. Open Postman
2. Click **Import** button (top left)
3. Drag and drop both files:
   - `Escrowly-Backend-Collection.postman_collection.json`
   - `Escrowly-Local-Environment.postman_environment.json`
4. Select **Escrowly Local Development** environment from the dropdown (top right)

**Option B: Using Import Link**
```
Collection URL: <Upload to Postman and get shareable link>
```

### 2. Start Backend Services

Ensure all required services are running:

```bash
# From project root
cd /home/weiblocks/Downloads/escrowly-backend

# Start infrastructure (PostgreSQL, Redis, Kafka)
docker compose up -d postgres redis redpanda

# Start each service (in separate terminals or use a process manager)
cd services/auth && npm run start:dev       # Port 3000
cd services/bff && npm run start:dev        # Port 3001
cd services/admin && npm run start:dev      # Port 3002
cd services/inquiry && npm run start:dev    # Port 3003
cd services/escrow && npm run start:dev     # Port 3004
cd services/ledger && npm run start:dev     # Port 3005
cd services/wallet && npm run start:dev     # Port 3006
cd services/notification && npm run start:dev # Port 3007
cd services/compliance && npm run start:dev # Port 3008
cd services/reporting && npm run start:dev  # Port 3009
```

**Verify services are running:**
```bash
curl http://localhost:3001/api/v1/health
```

### 3. Run Your First Test

**Test Sequence:**
1. Open the collection folder: `1. Authentication`
2. Run `Signup` request
   - ✅ Creates a new user
   - ✅ Automatically stores `userId`, `accessToken`, `refreshToken`
3. Run `Get Current User` request
   - ✅ Uses stored access token automatically
4. Explore other endpoints!

## 📚 Collection Structure

### 1. Authentication
- User registration and login
- JWT token management (automatic refresh)
- Multi-factor authentication (2FA)
- Password management
- OAuth flows (Google, GitHub)

### 2. Escrow Lifecycle
Complete escrow transaction flow:
1. Create Escrow → Stores `escrowId`
2. Accept Escrow (seller)
3. Process Payment
4. Record Delivery
5. Record Inspection
6. Complete Escrow
7. Alternative: File Dispute → Resolve

### 3. Ledger & Transfers
- Account balance queries
- Internal transfers (user-to-user)
- External transfers (blockchain withdrawals)
- Transaction history

### 4. Inquiry & Support
- Create support tickets
- Message threading
- File attachments
- Admin resolution

### 5. Notifications
- Notification preferences
- Email settings
- Notification history

### 6. KYC & Compliance
- KYC verification flow
- Status tracking
- User limits

### 7. Admin Operations
- Escrow management
- Dispute resolution
- User management
- Blog/content management
- System monitoring

### 8. Health Checks
- Service health status
- Readiness checks

## 🔐 Authentication

### Automatic Token Management

The collection includes **global pre-request scripts** that:
1. Check if access token is expired
2. Automatically refresh using refresh token
3. Update stored tokens
4. Retry original request with new token

**No manual token management needed!**

### Token Flow

```
1. Signup/Login → Stores accessToken & refreshToken
2. Any protected request → Automatically uses accessToken
3. Token expires (15 min) → Auto-refresh before request
4. Continue testing seamlessly
```

### Manual Token Refresh

If needed, you can manually refresh tokens:
```
POST {{baseUrl}}/auth/token/refresh
Body: { "refreshToken": "{{refreshToken}}" }
```

## 🧪 Test Scripts

Every request includes test scripts that:

**Validation:**
- ✅ Check HTTP status codes
- ✅ Validate response schemas
- ✅ Assert expected data structures

**Data Extraction:**
- 📦 Extract and store IDs automatically
- 📦 Chain requests using stored variables
- 📦 Build complete workflows

**Example:**
```javascript
// After "Create Escrow" request
pm.test('Escrow created successfully', function () {
    pm.response.to.have.status(201);
});

const response = pm.response.json();
pm.environment.set('escrowId', response.id);  // Store for next request
```

## 🔄 End-to-End Workflows

### Workflow 1: Complete Escrow Transaction

Run these requests in order:

1. **Authentication**
   - `Signup` → Creates User A (buyer)
   - Store userId as buyer

2. **Create Second User** (for seller)
   - `Signup` again with different email
   - Store userId as seller

3. **Create Escrow** (as buyer)
   - Uses buyer's accessToken
   - References sellerId
   - Stores escrowId

4. **Accept Escrow** (as seller)
   - Login as seller first
   - Use stored escrowId

5. **Complete Flow**
   - `Process Payment`
   - `Record Delivery`
   - `Record Inspection`
   - `Complete Escrow`

6. **Verify**
   - `Get Escrow by ID` → Check state = 'completed'
   - `Get User Balances` → Verify funds transferred

### Workflow 2: Dispute Resolution

1. Follow steps 1-4 from Workflow 1
2. `Record Delivery`
3. `File Dispute` (as buyer)
   - Stores disputeId
4. **Login as Admin**
   - Create admin user or use existing
5. `Resolve Dispute` (admin only)
   - Choose outcome (refund/release/split)
6. `Get Escrow History` → View all state transitions

### Workflow 3: KYC Verification

1. `Signup` → New user
2. `Start KYC Process`
   - Returns Persona verification URL
3. Complete KYC (external)
4. `Get KYC Status` → Check approval
5. `Get User Limits` → View increased limits

## 📊 Environment Variables

The environment automatically manages these variables:

### Service URLs
- `baseUrl` - BFF gateway (http://localhost:3001/api/v1)
- Individual service URLs (for direct access if needed)

### Authentication
- `accessToken` - JWT access token (auto-refreshed)
- `refreshToken` - JWT refresh token
- `tokenExpiry` - Token expiration timestamp
- `userId` - Current authenticated user
- `userEmail` - User email address

### Workflow Data
- `escrowId` - Current escrow transaction
- `inquiryId` - Current support inquiry
- `accountId` - Ledger account ID
- `transferId` - Transfer transaction ID
- `disputeId` - Dispute ID
- `categoryId` - Blog category ID
- `notificationId` - Notification log ID

### Multi-User Testing
- `sellerId` - Second user for escrow testing
- `toUserId` - Target user for transfers
- `adminUserId` - Admin user ID

## 🛠️ Advanced Usage

### Testing with Multiple Users

To test buyer/seller interactions:

1. **Create User A (Buyer):**
   ```
   Run: Signup
   Store: userId → Copy to "buyerId" variable manually
   ```

2. **Create User B (Seller):**
   ```
   Run: Signup again (new email)
   Store: userId → Copy to "sellerId" variable
   ```

3. **Switch Between Users:**
   - Login as User A → accessToken for buyer operations
   - Login as User B → accessToken for seller operations
   - Use Runner to automate multi-user flows

### Using Collection Runner

**Run Complete Workflow:**
1. Click **Run** on collection
2. Select folder: `2. Escrow Lifecycle`
3. Choose environment: `Escrowly Local Development`
4. Set iterations: 1
5. Click **Run Escrowly Backend...**

**Result:** Executes entire escrow flow automatically with test validation.

### Using Postman CLI (Newman)

Install Newman:
```bash
npm install -g newman
```

Run collection:
```bash
newman run Escrowly-Backend-Collection.postman_collection.json \
  -e Escrowly-Local-Environment.postman_environment.json \
  --folder "1. Authentication"
```

Run specific workflow:
```bash
newman run Escrowly-Backend-Collection.postman_collection.json \
  -e Escrowly-Local-Environment.postman_environment.json \
  --folder "2. Escrow Lifecycle" \
  --reporters cli,html \
  --reporter-html-export report.html
```

### API Documentation

Each service exposes Swagger/OpenAPI documentation:

```
Auth Service:         http://localhost:3000/api/docs
BFF Gateway:          http://localhost:3001/api/docs
Admin Service:        http://localhost:3002/api/docs
Inquiry Service:      http://localhost:3003/api/docs
Escrow Service:       http://localhost:3004/api/docs
Ledger Service:       http://localhost:3005/api/docs
Wallet Service:       http://localhost:3006/api/docs
Notification Service: http://localhost:3007/api/docs
Compliance Service:   http://localhost:3008/api/docs
Reporting Service:    http://localhost:3009/api/docs
```

## 🐛 Troubleshooting

### Issue: "401 Unauthorized"

**Cause:** Access token expired or invalid

**Solution:**
1. Run `Refresh Token` request manually
2. Or run `Login` again to get new tokens
3. Global script should auto-refresh, ensure it's enabled

### Issue: "Connection refused"

**Cause:** Service not running

**Solution:**
```bash
# Check which services are running
lsof -i :3000-3009

# Start missing service
cd services/<service-name> && npm run start:dev
```

### Issue: "Cannot find escrowId"

**Cause:** Variable not set

**Solution:**
1. Run `Create Escrow` first
2. Check test script executed: Console tab shows "Escrow ID: xxx"
3. Verify in Environment tab: escrowId has value

### Issue: "Insufficient balance"

**Cause:** Ledger account has no funds

**Solution:**
For testing, seed database with test funds:
```sql
-- In PostgreSQL
INSERT INTO ledger_db.accounts (user_id, asset, balance)
VALUES ('your-user-id', 'USDT', 10000);
```

Or use the admin API to credit test accounts.

### Issue: "KYC not approved"

**Cause:** Some operations require KYC approval

**Solution:**
1. For testing, update KYC status directly:
```sql
UPDATE auth_db.kyc_status
SET status = 'approved'
WHERE user_id = 'your-user-id';
```

2. Or complete actual KYC flow via Persona sandbox

## 📖 API Reference

### Authentication Tokens

**Access Token:**
- Expiry: 15 minutes (900 seconds)
- Format: JWT (HS256)
- Issuer: `escrowly-auth`
- Payload: userId, email, role, sessionId

**Refresh Token:**
- Expiry: 30 days
- Used to obtain new access tokens
- Implements rotation (new refresh token on each refresh)
- Includes reuse detection (revokes all sessions if reused)

### Common Request Patterns

**Pagination:**
```json
{
  "page": 1,
  "limit": 20
}
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

**Error Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Email must be valid"
    }
  ]
}
```

### Rate Limiting

Some endpoints are rate-limited:
- `POST /kyc/start` - 3 requests per hour per user
- `POST /auth/login` - 5 requests per minute per IP
- `POST /auth/password/forgot` - 3 requests per hour per email

**Rate Limit Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1609459200
```

## 🎯 Testing Best Practices

### 1. Use Descriptive Variable Names

Store related data together:
```javascript
// Good
pm.environment.set('buyer_escrow_id', escrowId);
pm.environment.set('seller_escrow_id', escrowId);

// Avoid
pm.environment.set('temp', escrowId);
```

### 2. Chain Requests Logically

Build workflows that mirror real user behavior:
```
Signup → Login → Create Escrow → Accept → Complete
```

### 3. Validate Responses Thoroughly

```javascript
pm.test('Response has expected structure', function () {
    const data = pm.response.json();
    pm.expect(data).to.have.property('id');
    pm.expect(data).to.have.property('state');
    pm.expect(data.state).to.be.oneOf(['agreement', 'accepted', 'completed']);
});
```

### 4. Clean Up Test Data

After testing, clear variables:
```javascript
// In test script
pm.environment.unset('escrowId');
pm.environment.unset('inquiryId');
```

### 5. Use Pre-request Scripts for Setup

```javascript
// Generate test data
const randomEmail = pm.variables.replaceIn('{{$randomEmail}}');
pm.environment.set('testEmail', randomEmail);
```

## 📝 Contributing

To add new endpoints:

1. **Add Request to Collection:**
   - Right-click folder → Add Request
   - Set method, URL, body
   - Add to appropriate folder

2. **Add Test Script:**
   ```javascript
   pm.test('Status code is 200', function () {
       pm.response.to.have.status(200);
   });

   // Extract and store IDs
   const response = pm.response.json();
   if (response.id) {
       pm.environment.set('someId', response.id);
   }
   ```

3. **Update Environment:**
   - Add new variables if needed
   - Document in this README

4. **Test Workflow:**
   - Run in Collection Runner
   - Verify all tests pass
   - Check variables are set correctly

## 🔗 Useful Links

- [Postman Documentation](https://learning.postman.com/docs/getting-started/introduction/)
- [Newman CLI](https://www.npmjs.com/package/newman)
- [Postman Test Scripts](https://learning.postman.com/docs/writing-scripts/test-scripts/)
- [Environment Variables](https://learning.postman.com/docs/sending-requests/variables/)

## 📄 License

This Postman collection is part of the Escrowly backend project.

## 🆘 Support

For issues or questions:
1. Check Swagger documentation: `http://localhost:3001/api/docs`
2. Review backend logs for detailed error messages
3. Open an issue in the project repository

---

**Happy Testing! 🚀**
