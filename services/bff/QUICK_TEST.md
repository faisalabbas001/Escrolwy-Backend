# Quick Test Guide - BFF Inquiry Service

> **Quick reference for testing the Inquiry Service integration**

---

## 🚀 Quick Start

### 1. Start All Services

```bash
# From project root
docker compose up -d

# Or start specific services
docker compose up -d postgres redis auth-service inquiry-service bff-service
```

### 2. Check Services Are Running

```bash
# Check all services
docker compose ps

# Check logs
docker compose logs -f bff-service
docker compose logs -f inquiry-service
```

### 3. Run Automated Test Script

```bash
cd services/bff
./test-inquiry.sh
```

This script will:
- ✅ Login and get JWT token
- ✅ Create an inquiry
- ✅ Get inquiry by ID
- ✅ Get inquiry by escrow ID
- ✅ Add a message
- ✅ Get messages
- ✅ Get attachments
- ✅ Test admin endpoints
- ✅ Close inquiry

---

## 🧪 Manual Testing (Quick)

### Step 1: Get JWT Token

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}' | jq -r '.accessToken')

echo "Token: $TOKEN"
```

### Step 2: Create Inquiry

```bash
INQUIRY_ID=$(curl -s -X POST http://localhost:3001/api/v1/inquiries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"escrow_id":"test-123","subject":"Test"}' | jq -r '.id')

echo "Inquiry ID: $INQUIRY_ID"
```

### Step 3: Test Endpoints

```bash
# Get inquiry
curl -X GET http://localhost:3001/api/v1/inquiries/$INQUIRY_ID \
  -H "Authorization: Bearer $TOKEN"

# Add message
curl -X POST http://localhost:3001/api/v1/inquiries/$INQUIRY_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sender_id":"user-123","sender_role":"buyer","message":"Hello"}'

# List inquiries (admin)
curl -X GET "http://localhost:3001/api/v1/admin/inquiries?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 Swagger UI Testing

1. **Open Swagger UI**:
   ```
   http://localhost:3001/api/docs
   ```

2. **Authorize**:
   - Click "Authorize" button
   - Enter: `Bearer <your-token>`
   - Click "Authorize"

3. **Test Endpoints**:
   - Expand `inquiries` tag
   - Try each endpoint
   - See request/response examples

---

## 🔍 Verify Integration

### Check BFF Logs

```bash
docker compose logs bff-service | grep -i inquiry
```

You should see:
```
[BFF → Inquiry] POST /api/v1/inquiries
[BFF → Inquiry] GET /api/v1/inquiries/...
```

### Check Inquiry Service Logs

```bash
docker compose logs inquiry-service | tail -20
```

### Verify Environment Variables

```bash
docker compose exec bff-service env | grep INQUIRY
# Should show: INQUIRY_SERVICE_URL=http://inquiry-service:3003
```

---

## ❌ Common Issues

### "Connection refused" to Inquiry Service

**Fix**: Make sure Inquiry Service is running
```bash
docker compose up -d inquiry-service
docker compose logs inquiry-service
```

### "401 Unauthorized"

**Fix**: Token expired or invalid - get new token
```bash
# Login again to get fresh token
curl -X POST http://localhost:3001/api/v1/auth/login ...
```

### "404 Not Found" for inquiry endpoints

**Fix**: Check route is correct (`/api/v1/inquiries/...`)
```bash
# Verify route in Swagger
open http://localhost:3001/api/docs
```

---

## 📖 Full Documentation

For detailed testing guide, see:
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Complete testing guide with all scenarios
- **[INQUIRY_INTEGRATION_GUIDE.md](./INQUIRY_INTEGRATION_GUIDE.md)** - Implementation details

---

**Quick Test Checklist**:
- [ ] Services running
- [ ] Test script passes
- [ ] Swagger UI accessible
- [ ] Can create inquiry
- [ ] Can get inquiry
- [ ] Can add message
- [ ] Admin endpoints work

