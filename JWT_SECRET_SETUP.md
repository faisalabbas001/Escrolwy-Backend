# JWT_SECRET Configuration Guide

> **How to set up JWT_SECRET for local development and testing**

---

## What is JWT_SECRET?

`JWT_SECRET` is a secret key used to sign and verify JWT (JSON Web Token) tokens. All services that generate or validate JWT tokens must use the **same secret**.

---

## Quick Setup for Local Development

### Step 1: Create .env File

Create a `.env` file in the **project root** (`escrowly-backend/.env`):

```bash
# From project root
cd /home/weiblocks/Downloads/escrowly-backend

# Create .env file
cat > .env << 'EOF'
# JWT Secret - Generate a secure random string (32+ characters)
JWT_SECRET=dev_jwt_secret_key_change_in_production_min_32_characters_long

# Optional: Frontend URL
FRONTEND_URL=http://localhost:5173
EOF
```

### Step 2: Generate a Secure Secret (Recommended)

For better security, generate a random secret:

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Using online generator (copy the output)
# Visit: https://generate-secret.vercel.app/32
```

**Example output**:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

Copy this value and set it in `.env`:
```env
JWT_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Step 3: Verify Configuration

```bash
# Check if .env file exists
cat .env

# Verify docker-compose will use it
docker-compose config | grep JWT_SECRET
```

---

## How It Works

### Docker Compose Configuration

In `docker-compose.yml`, each service reads `JWT_SECRET` like this:

```yaml
environment:
  JWT_SECRET: ${JWT_SECRET:-dummy_jwt_secret_change_after_deployment}
```

This means:
- `${JWT_SECRET}` - Reads from `.env` file or environment variable
- `:-dummy_jwt_secret...` - Uses default value if not set

### All Services Use the Same Secret

**Important**: These services **must** use the same `JWT_SECRET`:
- ✅ Auth Service (generates tokens)
- ✅ BFF Service (validates tokens)
- ✅ Admin Service (validates tokens)
- ✅ Inquiry Service (validates tokens)

If they don't match, authentication will fail!

---

## Setup Methods

### Method 1: .env File (Recommended)

**Location**: `escrowly-backend/.env` (project root)

```env
JWT_SECRET=your_secure_secret_here
```

**Pros**:
- ✅ Easy to manage
- ✅ Git-ignored (won't be committed)
- ✅ Works with docker-compose automatically

**Usage**:
```bash
# Just run docker-compose - it reads .env automatically
docker-compose up -d
```

### Method 2: Environment Variable

```bash
# Export before running docker-compose
export JWT_SECRET="your_secure_secret_here"
docker-compose up -d
```

**Pros**:
- ✅ No file needed
- ✅ Good for CI/CD

**Cons**:
- ❌ Need to export each time (unless in shell profile)

### Method 3: Default Value (Testing Only)

If you don't set `JWT_SECRET`, docker-compose uses:
```
dummy_jwt_secret_change_after_deployment
```

⚠️ **Warning**: Only use for quick testing! This is insecure.

---

## Verification

### Check if Services Are Using the Same Secret

```bash
# Check Auth Service
docker-compose exec auth-service env | grep JWT_SECRET

# Check BFF Service
docker-compose exec bff-service env | grep JWT_SECRET

# Check Inquiry Service (if running)
docker-compose exec inquiry-service env | grep JWT_SECRET
```

All should show the **same value**.

### Test Authentication

```bash
# Login (should work if JWT_SECRET matches)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# If successful, you'll get a token
# If JWT_SECRET mismatch, you'll get authentication errors
```

---

## Troubleshooting

### Issue: "Authentication failed" or "Invalid token"

**Cause**: JWT_SECRET mismatch between services

**Solution**:
1. Check all services use the same secret:
   ```bash
   docker-compose exec auth-service env | grep JWT_SECRET
   docker-compose exec bff-service env | grep JWT_SECRET
   ```

2. Restart services after changing .env:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Issue: Services can't read JWT_SECRET

**Cause**: .env file not in project root or wrong format

**Solution**:
1. Verify .env is in project root:
   ```bash
   ls -la .env  # Should exist
   ```

2. Check .env format (no spaces around `=`):
   ```env
   # ✅ Correct
   JWT_SECRET=your_secret_here
   
   # ❌ Wrong
   JWT_SECRET = your_secret_here
   ```

### Issue: Different secret per service

**Cause**: Each service has its own .env file

**Solution**: 
- ✅ Use **one** `.env` file in project root
- ✅ Docker Compose reads from project root `.env`
- ❌ Don't create `.env` files in individual service directories

---

## Production Setup

For production, use **AWS Secrets Manager** or similar secure secret management:

```typescript
// Services automatically use Secrets Manager in production
// via @escrowly/shared-config package
```

See `SECRETS_STRATEGY_FINAL.md` for production secrets management.

---

## Summary

1. **Create `.env` file** in project root
2. **Set JWT_SECRET** to a secure random string (32+ characters)
3. **Use the same secret** for all services
4. **Verify** all services read the same value
5. **Restart services** after changing .env

**Quick Command**:
```bash
# Generate secret and create .env
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
echo "FRONTEND_URL=http://localhost:5173" >> .env
```

---

**Last Updated**: 2024

