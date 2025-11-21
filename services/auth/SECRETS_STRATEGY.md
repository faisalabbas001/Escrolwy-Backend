# 🔐 Secrets Management Strategy

## 📋 **Overview**

This guide explains how we handle secrets (API keys, passwords, tokens) across different environments.

---

## 🎯 **Strategy: Abstraction Layer**

**Key Principle:** Code doesn't change between environments. Only the source of secrets changes.

### **How It Works:**

```
┌─────────────────────────────────────────────────────────┐
│ Your Code                                                │
│                                                          │
│  const jwtSecret = secretsService.getJwtSecret();       │
│                                                          │
│  ↑ Same code everywhere!                                │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        │                               │
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│ Local Dev        │          │ Dev/Stage/Prod   │
│                  │          │                  │
│ Reads from .env  │          │ Fetches from     │
│ file             │          │ Secrets Manager  │
└──────────────────┘          └──────────────────┘
```

---

## 🌍 **Environment-Specific Behavior**

### **1. Local Development** (Your Machine)

**Source:** `.env` file

**Why:**

- ✅ Standard practice (everyone uses .env locally)
- ✅ No AWS credentials needed
- ✅ Fast (no network calls)
- ✅ Easy to manage

**How it works:**

```typescript
// SecretsService detects: NODE_ENV=development
// → Uses ConfigService to read from .env
const jwtSecret = secretsService.getJwtSecret();
// Returns: process.env.JWT_SECRET
```

**Your `.env` file:**

```env
JWT_SECRET=my_local_secret_key
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

---

### **2. Dev Environment** (AWS - After Infra Deploy)

**Source:** AWS Secrets Manager

**Why:**

- ✅ Matches stage/prod (no code changes needed)
- ✅ Centralized secret management
- ✅ Secure (encrypted at rest)
- ✅ Audit trail (who accessed what, when)

**How it works:**

```typescript
// SecretsService detects: AWS_SECRETS_MANAGER_ARN is set (not dummy)
// → Fetches from Secrets Manager on startup
// → Caches in memory
const jwtSecret = secretsService.getJwtSecret();
// Returns: Cached value from Secrets Manager
```

**AWS Secrets Manager Secret:**

```json
{
  "JWT_SECRET": "dev_jwt_secret_key",
  "DATABASE_URL": "postgresql://aurora-endpoint...",
  "REDIS_URL": "redis://elasticache-endpoint...",
  "SMTP_PASSWORD": "email_service_password",
  "THIRD_PARTY_API_KEY": "api_key_here"
}
```

---

### **3. Stage/Production** (AWS)

**Source:** AWS Secrets Manager (same as dev)

**Why:**

- ✅ Production-grade security
- ✅ No secrets in code or environment variables
- ✅ Rotation support
- ✅ Access control via IAM

**How it works:**
Same as dev - fetches from Secrets Manager.

---

## 💻 **How to Use in Your Code**

### **Step 1: Inject SecretsService**

```typescript
import { SecretsService } from '../config';

@Injectable()
export class AuthService {
  constructor(
    private readonly secrets: SecretsService, // ← Inject
    // ... other services
  ) {}
}
```

### **Step 2: Use Helper Methods**

```typescript
// Get JWT secret
const jwtSecret = this.secrets.getJwtSecret();

// Get database URL
const dbUrl = this.secrets.getDatabaseUrl();

// Get Redis URL
const redisUrl = this.secrets.getRedisUrl();

// Get any secret
const apiKey = this.secrets.getSecret('THIRD_PARTY_API_KEY');
```

### **Step 3: Use in Your Logic**

```typescript
async generateToken(userId: string) {
  const secret = this.secrets.getJwtSecret();  // ← Works everywhere!

  return jwt.sign(
    { userId },
    secret,
    { expiresIn: '15m' }
  );
}
```

---

## 🔧 **Configuration**

### **Local Development**

**File:** `.env`

```env
# Application
NODE_ENV=development
PORT=3001

# Secrets (read from .env)
JWT_SECRET=local_jwt_secret_key
DATABASE_URL=postgresql://localhost:5432/escrowly?schema=auth_db
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092

# AWS (dummy values - not used locally)
AWS_SECRETS_MANAGER_ARN=arn:aws:secretsmanager:...:secret:dummy
AWS_REGION=us-east-1
```

**Behavior:** SecretsService reads from `.env` ✅

---

### **Dev Environment (AWS)**

**File:** `.env` (or environment variables in EKS)

```env
# Application
NODE_ENV=development  # Still dev, but using AWS resources
PORT=3001

# AWS Configuration (REAL values)
AWS_SECRETS_MANAGER_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:dev-escrowly-app-secrets-ABC123
AWS_REGION=us-east-1

# Database URL (can be in Secrets Manager or .env)
DATABASE_URL=postgresql://aurora-endpoint:5432/escrowly?schema=auth_db
```

**AWS Secrets Manager Secret (`dev-escrowly-app-secrets`):**

```json
{
  "JWT_SECRET": "dev_jwt_secret_rotate_me",
  "REDIS_URL": "redis://elasticache-endpoint:6379",
  "KAFKA_BROKERS": "kafka-endpoint:9092",
  "SMTP_PASSWORD": "email_service_password",
  "THIRD_PARTY_API_KEY": "api_key_value"
}
```

**Behavior:**

1. SecretsService detects `AWS_SECRETS_MANAGER_ARN` is set (not dummy)
2. Fetches secret from Secrets Manager on startup
3. Caches in memory
4. All `getSecret()` calls return cached values ✅

---

## 📝 **What Goes Where?**

### **✅ In .env (Local Only):**

- `JWT_SECRET` - For local development
- `DATABASE_URL` - Local PostgreSQL connection
- `REDIS_URL` - Local Redis connection
- `KAFKA_BROKERS` - Local Redpanda
- `SMTP_PASSWORD` - Local Mailhog (empty)

### **✅ In Secrets Manager (Dev/Stage/Prod):**

- `JWT_SECRET` - Production JWT secret
- `DATABASE_URL` - Aurora connection string (if sensitive)
- `REDIS_URL` - ElastiCache connection (if sensitive)
- `KAFKA_BROKERS` - MSK endpoints (if sensitive)
- `SMTP_PASSWORD` - Real email service password
- `THIRD_PARTY_API_KEY` - External API keys
- `ENCRYPTION_KEY` - KMS key IDs or encryption keys
- Any other sensitive credentials

### **✅ In .env (All Environments):**

- `NODE_ENV` - Environment name
- `PORT` - Service port
- `SERVICE_NAME` - Service identifier
- `AWS_REGION` - AWS region
- `AWS_SECRETS_MANAGER_ARN` - Secret ARN (to know which secret to fetch)
- `AWS_KMS_KEY_ARN` - KMS key ARN (not the key itself!)
- `AWS_S3_BUCKET` - S3 bucket name (not sensitive)

---

## 🚀 **Migration Path**

### **Phase 1: Local Development (Now)**

- ✅ Use `.env` file
- ✅ All secrets in `.env`
- ✅ Code uses `SecretsService.getJwtSecret()` etc.

### **Phase 2: Deploy Dev Infra**

- ✅ Create secret in AWS Secrets Manager
- ✅ Update `.env` with real `AWS_SECRETS_MANAGER_ARN`
- ✅ Code automatically switches to Secrets Manager
- ✅ No code changes needed! 🎉

### **Phase 3: Stage/Prod**

- ✅ Same code, different secret ARN
- ✅ Secrets Manager for all secrets
- ✅ IAM roles control access

---

## 🔍 **How SecretsService Decides**

```typescript
// Logic in SecretsService constructor:

const secretsManagerArn = config.get('AWS_SECRETS_MANAGER_ARN');
const nodeEnv = config.get('NODE_ENV', 'development');

// Use Secrets Manager if:
// 1. ARN is provided AND
// 2. ARN is not "dummy" AND
// 3. Not in local development mode
this.useSecretsManager =
  !!secretsManagerArn &&
  !secretsManagerArn.includes('dummy') &&
  nodeEnv !== 'development';
```

**Decision Tree:**

```
Is AWS_SECRETS_MANAGER_ARN set?
├─ No → Use .env
├─ Yes, but contains "dummy" → Use .env
├─ Yes, and NODE_ENV=development → Use .env (local dev)
└─ Yes, and NODE_ENV != development → Use Secrets Manager ✅
```

---

## 🧪 **Testing**

### **Local Testing:**

```typescript
// In your tests, mock SecretsService
const mockSecrets = {
  getJwtSecret: jest.fn().mockReturnValue('test_secret'),
  getDatabaseUrl: jest.fn().mockReturnValue('postgresql://...'),
};

// Or use real .env values (they're loaded automatically)
```

### **Integration Testing:**

- Use `.env.test` file
- Or mock SecretsService
- No need for real AWS credentials

---

## 📚 **Best Practices**

### **✅ DO:**

- Use `SecretsService` helper methods (`getJwtSecret()`, etc.)
- Store sensitive values in Secrets Manager (dev/stage/prod)
- Use `.env` for local development
- Keep non-sensitive config in `.env` (bucket names, regions, etc.)

### **❌ DON'T:**

- Hardcode secrets in code
- Commit `.env` files to git
- Store secrets in environment variables in production (use Secrets Manager)
- Access Secrets Manager directly (use SecretsService abstraction)

---

## 🔐 **Security Notes**

1. **Local Development:**
   - `.env` file is in `.gitignore` ✅
   - Never commit secrets

2. **AWS Environments:**
   - Secrets Manager encrypts at rest
   - IAM policies control access
   - Audit logs track access
   - Supports automatic rotation

3. **Code:**
   - No secrets in code
   - No secrets in Docker images
   - Secrets fetched at runtime

---

## 🎯 **Summary**

| Environment   | Secret Source   | Code Changes? |
| ------------- | --------------- | ------------- |
| **Local Dev** | `.env` file     | ❌ None       |
| **Dev (AWS)** | Secrets Manager | ❌ None       |
| **Stage**     | Secrets Manager | ❌ None       |
| **Prod**      | Secrets Manager | ❌ None       |

**Result:** Write code once, works everywhere! 🎉

---

## 📖 **Example: Using Secrets in Auth Service**

```typescript
import { SecretsService } from '../config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly secrets: SecretsService,
    private readonly jwtService: JwtService,
  ) {}

  async generateToken(userId: string) {
    // Get secret - works in all environments!
    const secret = this.secrets.getJwtSecret();

    return this.jwtService.sign({ userId }, { secret, expiresIn: '15m' });
  }

  async connectToDatabase() {
    // Get database URL - works in all environments!
    const dbUrl = this.secrets.getDatabaseUrl();
    // ... use dbUrl
  }
}
```

**That's it!** The same code works in local dev (reads `.env`) and AWS (reads Secrets Manager). 🚀
