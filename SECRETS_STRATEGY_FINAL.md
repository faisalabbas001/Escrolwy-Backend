# 🔐 Final Secrets Management Strategy

## 📋 **Overview**

This document explains the **final, production-ready** secrets management strategy for Escrowly.

---

## 🎯 **Strategy Summary**

| Environment   | AWS Services Used | Secrets Source  | Code Changes? |
| ------------- | ----------------- | --------------- | ------------- |
| **Local Dev** | Aurora, KMS, S3   | `.env` file     | ❌ None       |
| **Stage**     | Full AWS Stack    | Secrets Manager | ❌ None       |
| **Prod**      | Full AWS Stack    | Secrets Manager | ❌ None       |

**Key Principle:** Code doesn't change. Only the source of secrets changes.

---

## 🏗️ **Architecture: Shared Package**

**Problem:** 7+ services would duplicate SecretsService code.

**Solution:** **Shared package** (`@escrowly/shared-config`) used by ALL services.

```
packages/
└── shared-config/          ← Single source of truth
    ├── src/
    │   ├── secrets.service.ts
    │   └── secrets.module.ts
    └── package.json

services/
├── auth/                   ← Uses @escrowly/shared-config
├── wallet/                 ← Uses @escrowly/shared-config
├── ledger/                 ← Uses @escrowly/shared-config
└── ... (all 7+ services)   ← Uses @escrowly/shared-config
```

**Result:** No code duplication! ✅

---

## 🌍 **Environment Details**

### **1. Local Development**

**AWS Services Used:**

- ✅ **Aurora Serverless v2** (min 0.5 ACU) - Minimal cost, scales to zero when idle
- ✅ **KMS** - For encryption keys
- ✅ **S3** - For document/image storage

**Local Services (Docker):**

- ✅ **Redis** - Caching, sessions
- ✅ **Redpanda** - Event streaming (Kafka-compatible)
- ✅ **Mailhog** - Email testing

**Secrets Source:** `.env` file

**Why:**

- Standard practice (everyone uses `.env` locally)
- No AWS credentials needed for secrets
- Fast (no network calls)
- Easy to manage

**Configuration:**

```env
# .env file
NODE_ENV=development

# AWS Services (real endpoints after infra deploy)
DATABASE_URL=postgresql://aurora-endpoint:5432/escrowly?schema=auth_db
AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/dev-escrowly-kms-key
AWS_S3_BUCKET=dev-escrowly-files
AWS_REGION=us-east-1

# Secrets (in .env for local dev)
JWT_SECRET=local_jwt_secret_key
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
SMTP_PASSWORD=

# AWS Secrets Manager (dummy - not used in local dev)
AWS_SECRETS_MANAGER_ARN=arn:aws:secretsmanager:...:secret:dummy
```

**How SecretsService Works:**

```typescript
// Detects: NODE_ENV=development
// → Uses .env file (even though connecting to AWS Aurora/KMS/S3)
const jwtSecret = secretsService.getJwtSecret();
// Returns: process.env.JWT_SECRET from .env
```

---

### **2. Stage Environment**

**AWS Services Used:**

- ✅ **EKS** - Kubernetes cluster
- ✅ **Aurora Serverless v2** - Database
- ✅ **MSK** - Managed Kafka
- ✅ **ElastiCache** - Redis
- ✅ **KMS** - Encryption
- ✅ **S3** - Storage
- ✅ **Secrets Manager** - Secrets storage

**Secrets Source:** AWS Secrets Manager

**Configuration:**

```env
# Environment variables (in EKS)
NODE_ENV=stage
AWS_SECRETS_MANAGER_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:stage-escrowly-app-secrets-ABC123
AWS_REGION=us-east-1
```

**AWS Secrets Manager Secret:**

```json
{
  "JWT_SECRET": "stage_jwt_secret_rotate_me",
  "DATABASE_URL": "postgresql://aurora-endpoint:5432/escrowly?schema=auth_db",
  "REDIS_URL": "redis://elasticache-endpoint:6379",
  "KAFKA_BROKERS": "kafka-endpoint:9092",
  "SMTP_PASSWORD": "email_service_password",
  "THIRD_PARTY_API_KEY": "api_key_value"
}
```

**How SecretsService Works:**

```typescript
// Detects: NODE_ENV=stage AND AWS_SECRETS_MANAGER_ARN is real (not dummy)
// → Fetches from Secrets Manager on startup
// → Caches in memory
const jwtSecret = secretsService.getJwtSecret();
// Returns: Cached value from Secrets Manager
```

---

### **3. Production Environment**

Same as Stage, but with:

- Higher capacity
- Multi-AZ deployment
- Enhanced monitoring
- Different Secrets Manager secret ARN

---

## 💻 **How to Use in Your Services**

### **Step 1: Install Shared Package**

In each service's `package.json`:

```json
{
  "dependencies": {
    "@escrowly/shared-config": "file:../../packages/shared-config"
  }
}
```

Then run:

```bash
npm install
```

### **Step 2: Import in Service Module**

```typescript
import { SecretsModule } from "@escrowly/shared-config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SecretsModule, // ← Import shared module
    // ... other modules
  ],
})
export class AppModule {}
```

### **Step 3: Inject in Your Service**

```typescript
import { SecretsService } from "@escrowly/shared-config";

@Injectable()
export class YourService {
  constructor(
    private readonly secrets: SecretsService, // ← Inject
  ) {}

  async doSomething() {
    // Get secrets - works everywhere!
    const jwtSecret = this.secrets.getJwtSecret();
    const dbUrl = this.secrets.getDatabaseUrl();
    const kmsKeyArn = this.secrets.getKmsKeyArn();
    const s3Bucket = this.secrets.getS3Bucket();

    // Use them...
  }
}
```

---

## 🔍 **How SecretsService Decides**

```typescript
// Logic in SecretsService constructor:

const secretsManagerArn = config.get("AWS_SECRETS_MANAGER_ARN");
const nodeEnv = config.get("NODE_ENV", "development");

// Use Secrets Manager if:
// 1. ARN is provided AND
// 2. ARN is not "dummy" AND
// 3. Environment is stage or production (NOT development)
this.useSecretsManager =
  !!secretsManagerArn &&
  !secretsManagerArn.includes("dummy") &&
  (nodeEnv === "stage" || nodeEnv === "production");
```

**Decision Tree:**

```
Is AWS_SECRETS_MANAGER_ARN set?
├─ No → Use .env
├─ Yes, but contains "dummy" → Use .env
├─ Yes, and NODE_ENV=development → Use .env (local dev)
└─ Yes, and NODE_ENV=stage/production → Use Secrets Manager ✅
```

---

## 🏗️ **Dev Infrastructure (AWS)**

**Location:** `infra/cdk/dev/dev-stack.ts`

**What's Deployed:**

- ✅ **Aurora Serverless v2**
  - Min: 0.5 ACU (scales to zero when idle)
  - Max: 1 ACU
  - **Cost:** ~$0.10/hour when active, $0 when idle
- ✅ **KMS Key**
  - **Cost:** $1/month + $0.03 per 10,000 requests
- ✅ **S3 Bucket**
  - **Cost:** $0.023/GB storage + $0.005/1,000 requests
- ✅ **Secrets Manager** (created but not used in local dev)
  - **Cost:** $0.40/month per secret

**Total Estimated Cost:** ~$5-10/month for minimal usage

**Deploy:**

```bash
cd infra/cdk/dev
npm install
cdk deploy
```

**Outputs:**

- Aurora endpoint (use in `DATABASE_URL`)
- KMS key ARN (use in `AWS_KMS_KEY_ARN`)
- S3 bucket name (use in `AWS_S3_BUCKET`)
- Secrets Manager ARN (not used in local dev, but available)

---

## 📝 **What Goes Where?**

### **✅ In .env (Local Dev Only):**

```env
# Application config
NODE_ENV=development
PORT=3001
SERVICE_NAME=auth-service

# AWS Services (real endpoints after infra deploy)
DATABASE_URL=postgresql://aurora-endpoint:5432/escrowly?schema=auth_db
AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/dev-escrowly-kms-key
AWS_S3_BUCKET=dev-escrowly-files
AWS_REGION=us-east-1

# Secrets (in .env for local dev)
JWT_SECRET=local_jwt_secret_key
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
SMTP_PASSWORD=

# AWS Secrets Manager (dummy - not used)
AWS_SECRETS_MANAGER_ARN=arn:aws:secretsmanager:...:secret:dummy
```

### **✅ In Secrets Manager (Stage/Prod Only):**

```json
{
  "JWT_SECRET": "production_jwt_secret",
  "DATABASE_URL": "postgresql://aurora-endpoint:5432/escrowly?schema=auth_db",
  "REDIS_URL": "redis://elasticache-endpoint:6379",
  "KAFKA_BROKERS": "kafka-endpoint:9092",
  "SMTP_PASSWORD": "email_service_password",
  "THIRD_PARTY_API_KEY": "api_key_value"
}
```

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

1. ✅ Deploy dev infra: `cdk deploy`
2. ✅ Update `.env` with Aurora/KMS/S3 endpoints
3. ✅ Use `.env` for secrets
4. ✅ Code uses `SecretsService` from shared package

### **Phase 2: Stage Deployment**

1. ✅ Create secret in AWS Secrets Manager
2. ✅ Set `NODE_ENV=stage` in EKS
3. ✅ Set real `AWS_SECRETS_MANAGER_ARN` in EKS
4. ✅ Code automatically switches to Secrets Manager
5. ✅ No code changes needed! 🎉

### **Phase 3: Production**

1. ✅ Same as stage, different secret ARN
2. ✅ IAM roles control access
3. ✅ Enhanced monitoring

---

## 📚 **Best Practices**

### **✅ DO:**

- Use `@escrowly/shared-config` in all services
- Store sensitive values in Secrets Manager (stage/prod)
- Use `.env` for local development
- Keep non-sensitive config in `.env` (bucket names, regions, etc.)
- Deploy dev infra for Aurora/KMS/S3 (minimal cost)

### **❌ DON'T:**

- Duplicate SecretsService code in each service
- Hardcode secrets in code
- Commit `.env` files to git
- Store secrets in environment variables in production (use Secrets Manager)
- Access Secrets Manager directly (use SecretsService abstraction)

---

## 🎯 **Summary**

1. **Shared Package:** `@escrowly/shared-config` - No code duplication ✅
2. **Local Dev:** `.env` file (even when using AWS Aurora/KMS/S3) ✅
3. **Stage/Prod:** Secrets Manager ✅
4. **Code:** Same code everywhere - no changes needed ✅
5. **Dev Infra:** Aurora (min 0.5 ACU), KMS, S3 - Minimal cost ✅

**Result:** Write code once, works everywhere! 🎉

---

## 📖 **Example: Using in Auth Service**

```typescript
import { SecretsService } from "@escrowly/shared-config";

@Injectable()
export class AuthService {
  constructor(private readonly secrets: SecretsService) {}

  async generateToken(userId: string) {
    const secret = this.secrets.getJwtSecret(); // ← Works everywhere!
    return jwt.sign({ userId }, secret, { expiresIn: "15m" });
  }

  async connectToDatabase() {
    const dbUrl = this.secrets.getDatabaseUrl(); // ← Works everywhere!
    // ... connect
  }
}
```

**That's it!** The same code works in:

- Local dev (reads `.env`)
- Stage (reads Secrets Manager)
- Prod (reads Secrets Manager)

---

**Questions?** Check `packages/shared-config/README.md` for more details.
