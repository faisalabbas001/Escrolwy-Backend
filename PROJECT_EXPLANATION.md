# 🏦 Escrowly Backend - Complete Project Explanation

A beginner-friendly guide to understanding the Escrowly backend platform - a crypto escrow and wallet management system built with microservices.

---

## 📋 Table of Contents

1. [What is Escrowly?](#what-is-escrowly)
2. [Project Architecture](#project-architecture)
3. [Main Features](#main-features)
4. [How Everything Works Together](#how-everything-works-together)
5. [Folder Structure Breakdown](#folder-structure-breakdown)
6. [File-by-File Explanation](#file-by-file-explanation)
7. [Workflow: From Request to Response](#workflow-from-request-to-response)
8. [Setting Up & Running Locally](#setting-up--running-locally)

---

## 🎯 What is Escrowly?

**Escrowly** is a backend platform that manages cryptocurrency transactions safely using **escrow** (a trusted third party holding money during a transaction).

### Core Purpose:
- **Secure crypto transactions** - Hold cryptocurrency safely during deals
- **Multi-user wallets** - Users can hold and manage crypto
- **Transaction ledger** - Track all movements and balances
- **Admin dashboard** - Manage users, content, and support tickets
- **User authentication** - Secure login and account management

### Real-World Example:
```
Alice wants to buy crypto from Bob.
↓
Alice deposits money with Escrowly (escrow)
↓
Bob sees the money is held safely
↓
Bob delivers the crypto
↓
Escrowly releases the money to Bob
↓
Everyone gets their crypto/money safely!
```

---

## 🏗️ Project Architecture

### **High-Level Overview**

```
                    ┌─────────────────────┐
                    │   Frontend (React)  │
                    │   Port 5173         │
                    └──────────┬──────────┘
                               │ HTTP Requests
                               ↓
                    ┌─────────────────────┐
                    │    BFF Gateway      │ ← Routes requests
                    │   (Port 3000)       │   to right service
                    └────┬────────┬───────┘
         ┌────────────────┴────────┴──────────────┐
         ↓                ↓                        ↓
    ┌─────────┐    ┌─────────┐    ┌──────────┐
    │   Auth  │    │  Admin  │    │ (Future) │
    │ Service │    │ Service │    │ Services │
    │ 3001    │    │ 3002    │    │          │
    └────┬────┘    └────┬────┘    └──────────┘
         │              │
    ┌────┴──────────────┴────┐
    │                        │
    │   PostgreSQL (Aurora)  │
    │   Single Database      │
    │   Multiple Schemas:    │
    │                        │
    │  - auth_db ✅          │
    │  - admin_db ✅         │
    │  - wallet_db (future)  │
    │  - ledger_db (future)  │
    │  - ... more schemas    │
    │                        │
    └────────────────────────┘
    
    Supporting Services (Docker):
    - Redis (caching, sessions)
    - Kafka (events)
    - Mailhog (email testing)
```

### **Key Architectural Principles**

1. **Microservices**: Each service handles one responsibility
2. **Multi-Schema Database**: Single PostgreSQL instance with separate schemas for each service
3. **API Gateway Pattern**: BFF service routes all requests to appropriate backends
4. **JWT Authentication**: Secure token-based auth
5. **Shared Code**: Common configurations in `packages/shared-config`

---

## ✨ Main Features

### **1. User Authentication (Auth Service)**
- ✅ User registration (signup)
- ✅ User login with JWT tokens
- ✅ Password hashing (secure)
- ✅ Session management with Redis
- ✅ Token refresh capability
- ✅ User profile management
- 🔜 Multi-factor authentication (future)

### **2. Admin Dashboard (Admin Service)**
- ✅ Blog management (create, read, update, delete posts)
- ✅ Help desk/FAQ system (categories, questions)
- ✅ File uploads to AWS S3
- ✅ User management (future)
- ✅ System health monitoring

### **3. Future Services (Planned)**
- **Wallet Service** - Cryptocurrency wallet management
- **Ledger Service** - Transaction history and accounting
- **Escrow Service** - Escrow transactions and dispute handling
- **Compliance Service** - KYC/AML verification
- **Reporting Service** - Analytics and reports
- And more...

---

## 🔄 How Everything Works Together

### **User Registration Flow**

```
Frontend (React)
    ↓ POST /api/v1/auth/signup
    ↓ {"email": "john@example.com", "password": "..."}
    ↓
BFF Gateway (validates request format)
    ↓ forwards to Auth Service
    ↓
Auth Service
    ↓ creates user in database
    ↓ hashes password with Argon2
    ↓ creates JWT token
    ↓ stores session in Redis
    ↓
Returns to Frontend
    ↓ {"accessToken": "jwt...", "refreshToken": "..."}
    ↓
Frontend stores token in browser
    ↓ uses token for future API calls
```

### **User Login Flow**

```
Frontend
    ↓ POST /api/v1/auth/login
    ↓ {"email": "john@example.com", "password": "..."}
    ↓
BFF Gateway
    ↓
Auth Service
    ↓ finds user by email
    ↓ verifies password hash
    ↓ generates JWT token
    ↓ creates session in Redis
    ↓
Returns JWT token to Frontend
```

### **Protected API Request Flow**

```
Frontend (with Authorization token)
    ↓ GET /api/v1/admin/blogs
    ↓ Header: "Authorization: Bearer jwt_token_here"
    ↓
BFF Gateway
    ↓ validates JWT signature
    ↓ if invalid → returns 401 Unauthorized
    ↓ if valid → extracts user info → forwards request
    ↓
Admin Service (receives authenticated request)
    ↓ knows which user is making request
    ↓ retrieves blogs from database
    ↓
Returns blog list to Frontend
```

---

## 📁 Folder Structure Breakdown

### **Root Level**

```
escrowly-backend/
├── README.md                    # Project overview
├── SETUP_GUIDE.md               # How to get started locally
├── IMPLEMENTATION_COMPLETE.md   # What's been built
├── SECRETS_STRATEGY_FINAL.md    # How secrets are managed
├── SERVICES_OVERVIEW.md         # All microservices listed
├── package.json                 # Root workspace config
├── docker-compose.yml           # Local development services
│
├── services/                    # All microservices
├── packages/                    # Shared code
├── infra/                       # Cloud infrastructure
└── scripts/                     # Utility scripts
```

### **services/ - The Core Microservices**

```
services/
├── auth/                        ✅ READY - User authentication
│   ├── src/
│   │   ├── main.ts             # App startup
│   │   ├── app.module.ts       # Root module (imports all features)
│   │   ├── app.service.ts      # Service-level logic
│   │   ├── app.controller.ts   # HTTP endpoints
│   │   │
│   │   ├── auth/               # Authentication logic
│   │   │   ├── auth.service.ts       # Signup, login, token logic
│   │   │   ├── auth.controller.ts    # HTTP endpoints (/auth/*)
│   │   │   ├── jwt.service.ts        # JWT token creation/validation
│   │   │   ├── session.service.ts    # Redis session management
│   │   │   └── dto/                  # Data models
│   │   │
│   │   ├── health/             # Health check endpoints
│   │   │   ├── health.service.ts
│   │   │   ├── health.controller.ts
│   │   │   └── health.module.ts
│   │   │
│   │   ├── prisma/             # Database client
│   │   │   ├── prisma.service.ts    # Handles DB connections
│   │   │   └── prisma.module.ts
│   │   │
│   │   └── test/               # Test utilities
│   │
│   ├── prisma/
│   │   ├── schema.prisma       # Database tables for auth_db
│   │   └── migrations/         # Database change history
│   │
│   ├── test/                   # End-to-end tests
│   ├── package.json            # Dependencies
│   ├── tsconfig.json           # TypeScript config
│   └── Dockerfile              # Docker image def
│
├── admin/                        🔜 Blog & Help Desk management
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   │
│   │   ├── blog/               # Blog management
│   │   │   ├── blog.service.ts
│   │   │   ├── blog.controller.ts
│   │   │   └── dto/
│   │   │
│   │   ├── help-desk/          # FAQ/Support system
│   │   │   ├── help-desk.service.ts
│   │   │   ├── help-desk.controller.ts
│   │   │   └── dto/
│   │   │
│   │   ├── upload/             # File uploads to S3
│   │   │   ├── s3.service.ts
│   │   │   ├── upload.controller.ts
│   │   │   └── upload.module.ts
│   │   │
│   │   ├── cache/              # Redis caching
│   │   │   ├── cache.service.ts
│   │   │   └── cache.module.ts
│   │   │
│   │   ├── health/
│   │   ├── prisma/
│   │   └── test/
│   │
│   ├── prisma/
│   │   ├── schema.prisma       # Database tables for admin_db
│   │   └── migrations/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
└── bff/                         🔜 API Gateway (routes requests)
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   │
    │   ├── auth/               # Routes to Auth Service
    │   │   └── (auth endpoints)
    │   │
    │   ├── admin/              # Routes to Admin Service
    │   │   └── (admin endpoints)
    │   │
    │   ├── proxy/              # HTTP client for backend calls
    │   │   └── proxy.service.ts
    │   │
    │   ├── common/             # Shared utilities
    │   │   └── (guards, interceptors)
    │   │
    │   └── health/
    │
    ├── package.json
    ├── tsconfig.json
    └── Dockerfile
```

### **packages/ - Shared Code**

```
packages/
└── shared-config/              # Used by ALL services
    ├── src/
    │   ├── secrets.service.ts  # Manages API keys, passwords, etc
    │   ├── secrets.module.ts   # NestJS module
    │   └── index.ts            # Exports for other services
    ├── package.json            # Published to npm as @escrowly/shared-config
    └── tsconfig.json
```

**Why?** Instead of each service copying secrets code, they all import from this shared package. Change once, affects all services! ✅

### **infra/ - Cloud Infrastructure Setup**

```
infra/
└── cdk/                         # AWS CDK (Infrastructure as Code)
    ├── bin/
    │   ├── dev.ts              # Local dev stack configuration
    │   └── ec2.ts              # Production EC2 stack config
    │
    ├── lib/
    │   ├── dev-stack.ts        # Creates: Aurora, KMS, S3
    │   └── ec2-stack.ts        # Creates: EC2, RDS, etc
    │
    ├── package.json
    ├── tsconfig.json
    └── cdk.json                # CDK settings
```

**Purpose:** Automatically creates AWS resources (databases, encryption, storage) in the cloud.

### **scripts/ - Utility Scripts**

```
scripts/
├── init-schemas.sql            # Creates auth_db, admin_db, etc schemas
├── migrate-auth.js             # Apply database migrations
├── test-auth-signup.js         # Test user registration
├── test-auth-login.js          # Test user login
├── test-bff.js                 # Test BFF gateway
└── ... (more test scripts)
```

---

## 📄 File-by-File Explanation

### **Auth Service - Core Files**

#### `services/auth/src/main.ts`
**What it does:** Starts the Auth Service application

**Key steps:**
1. Creates NestJS app
2. Enables CORS (allows requests from frontend)
3. Sets up API versioning (`/api/v1/...`)
4. Creates Swagger documentation
5. Starts server on port 3001

**Simple analogy:** This is like the "On" switch for the Auth Service. It turns everything on and gets ready to receive requests.

---

#### `services/auth/src/app.module.ts`
**What it does:** Organizes all the features the service has

**Imports (loads these features):**
- `ConfigModule` - Load environment variables from `.env`
- `SecretsModule` - Access API keys and passwords securely
- `PrismaModule` - Talk to database
- `HealthModule` - Report if service is healthy
- `AuthModule` - Signup, login functionality

**Simple analogy:** This is like a restaurant's organization chart. It says "we have a kitchen module, a waitstaff module, a cashier module" - all the departments needed to run.

---

#### `services/auth/src/auth/auth.service.ts`
**What it does:** The actual login and signup logic

**Main functions:**
- `signup(email, password)` - Create new user
- `login(email, password)` - Validate user exists and password is correct
- `refreshToken()` - Generate new JWT token

**How signup works:**
```typescript
1. Check if email already registered
2. Hash password with Argon2 (very secure)
3. Create user in database
4. Generate JWT token
5. Create session in Redis
6. Return tokens to user
```

**Simple analogy:** This is the bouncer at the club. They check your ID, verify you're allowed in, then give you a wristband (token).

---

#### `services/auth/src/auth/jwt.service.ts`
**What it does:** Creates and validates JWT tokens

**JWT Token explained:**
```
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

Parts:
[Header].[Payload].[Signature]

Header: Algorithm and type
Payload: User info (id, email, expiration)
Signature: Proof it wasn't tampered with (secret key)
```

**Functions:**
- `generateToken(userId)` - Creates a new JWT
- `validateToken(token)` - Checks if JWT is real and not expired

**Simple analogy:** JWT is like a passport. It contains your info, has a security feature (signature), and expires at a certain date.

---

#### `services/auth/src/auth/session.service.ts`
**What it does:** Manages user sessions in Redis (cache)

**Why separate from JWT?**
- JWT is stateless (no server memory needed)
- Sessions track active users (server memory used)
- Together they're very secure

**Functions:**
- `createSession(userId)` - Record that user just logged in
- `getSession(token)` - Check if user has valid session
- `destroySession(token)` - Logout user

**Simple analogy:** While JWT is your passport, sessions are like check-in at a hotel. You have a room number (token) and the hotel checks you haven't checked out yet.

---

#### `services/auth/prisma/schema.prisma`
**What it does:** Defines database tables for auth_db

**Main tables:**

```prisma
User {
  id: UUID
  email: Text (unique)
  phone: Text
  role: "user" | "super-admin" | "staff-website"
  status: "active" | "locked" | "disabled"
  kycStatus: "not_started" | "pending" | "approved" | "rejected"
  displayName, companyName, etc.
  createdAt, updatedAt, deletedAt
}

AuthCredential {
  id: UUID
  userId: FK → User
  passwordHash: Text (hashed, NOT plain password!)
  mfaEnabled: Boolean
  oauthProvider, oauthSubject: For OAuth login
}

UserProfile {
  id: UUID
  userId: FK → User
  (extended user info)
}
```

**What it DOESN'T store:**
- Plain passwords ❌ (only hashes)
- API keys ❌ (use SecretsService)
- Private keys ❌ (never in database)

**Simple analogy:** This is the blueprint for the filing cabinets. It says "we have a drawer for users, a drawer for credentials, a drawer for profiles."

---

### **Admin Service - Core Files**

#### `services/admin/src/main.ts`
**What it does:** Same as Auth, but for Admin Service on port 3002

---

#### `services/admin/src/blog/blog.service.ts`
**What it does:** CRUD operations for blog posts

**Functions:**
- `createBlog(title, content)` - Write new post
- `getBlog(id)` - Read one post
- `getAllBlogs()` - List all posts
- `updateBlog(id, content)` - Edit post
- `deleteBlog(id)` - Remove post

**Simple analogy:** This is the blog writer's tool. Create, read, update, delete - like a notepad app.

---

#### `services/admin/src/help-desk/help-desk.service.ts`
**What it does:** Manage FAQs and support categories

**Features:**
- Create categories (e.g., "How to transfer?", "Security")
- Create questions in each category
- Create answers to questions
- Organization system for support content

**Simple analogy:** Think of it like organizing a customer service FAQ section. Categories → Questions → Answers.

---

#### `services/admin/src/upload/s3.service.ts`
**What it does:** Upload files to AWS S3 (cloud storage)

**Functions:**
- `uploadFile(file)` - Send file to AWS
- `getFileUrl(key)` - Get public URL to download file
- `deleteFile(key)` - Remove file from AWS

**Simple analogy:** This is like FedEx for files. You give it a file, it stores it safely in the cloud, and gives you a tracking number (URL) to retrieve it.

---

### **BFF Service - API Gateway**

#### `services/bff/src/main.ts`
**What it does:** Start the gateway on port 3000

---

#### `services/bff/src/app.module.ts`
**What it does:** Sets up request routing

**Key parts:**
- `ProxyModule` - HTTP client to call Auth/Admin services
- `AuthModule` - Routes `/auth/*` to Auth Service
- `AdminModule` - Routes `/admin/*` to Admin Service
- `JwtAuthGuard` - Validates tokens on ALL requests

**Simple analogy:** BFF is like a receptionist at an office building. You ask them "where's the accounting department?" and they point you there.

---

#### `services/bff/src/common/jwt-auth.guard.ts`
**What it does:** Validates every incoming request has a valid JWT token

**Flow:**
```
Request comes in with token
    ↓
Guard extracts token from header
    ↓
Guard validates token signature
    ↓
Guard checks if token expired
    ↓
If invalid → return 401 Unauthorized
If valid → allow request through
```

**Simple analogy:** This is airport security. Your token is your boarding pass. If it's invalid or expired, you can't board.

---

### **Shared Config Package**

#### `packages/shared-config/src/secrets.service.ts`
**What it does:** Safely access API keys, passwords, database URLs

**How it works:**

```typescript
// In development:
const jwtSecret = process.env.JWT_SECRET  // from .env file

// In production:
const jwtSecret = getFromSecretsManager()  // from AWS

// Code doesn't change! ✅
```

**Functions:**
- `getJwtSecret()` - JWT signing key
- `getDatabaseUrl()` - PostgreSQL connection
- `getRedisUrl()` - Redis connection
- `getS3Config()` - AWS S3 credentials

**Why this exists:** 

Never hardcode passwords in code! They'd be visible in Git history and very insecure. Instead, use environment variables or secret managers.

**Simple analogy:** This is a safe deposit box. You don't keep your valuable passwords lying around. You store them securely and retrieve only when needed.

---

### **Docker Compose Configuration**

#### `docker-compose.yml`
**What it does:** Defines all local development services

```yaml
Services started:
1. PostgreSQL (port 5433)      - Main database
2. Redis (port 6379)           - Caching & sessions
3. Redpanda (port 9092)        - Event streaming (Kafka)
4. Mailhog (port 8025)         - Email testing (no real emails sent)
5. PgAdmin (port 5050)         - Database GUI
```

**Why local?** These run on your computer, so:
- ✅ No AWS costs
- ✅ Fast (no network)
- ✅ Easy to reset
- ✅ Works offline

**Simple analogy:** This is like a miniature version of the entire system running on your laptop.

---

### **Database Initialization**

#### `scripts/init-schemas.sql`
**What it does:** Creates empty database schemas when PostgreSQL starts

**Schemas created:**
```sql
auth_db        -- Auth Service will use this
admin_db       -- Admin Service will use this
wallet_db      -- Wallet Service (future) will use this
ledger_db      -- Ledger Service (future) will use this
escrow_db      -- Escrow Service (future) will use this
... and more
```

**Why separate schemas?**
```
✅ One database (easy to backup)
✅ Multiple isolated schemas (services don't interfere)
✅ Single connection string (simpler config)
✅ Easy to manage all schemas in one place
```

**Simple analogy:** Like one office building with separate departments. One landlord (database) but multiple floor plans (schemas).

---

## 🔄 Workflow: From Request to Response

### **Example: User Registration**

Let's follow a signup request step-by-step:

```
STEP 1: Frontend sends request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST http://localhost:3000/api/v1/auth/signup
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "SecurePassword123",
  "acceptTerms": true
}


STEP 2: BFF receives request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. BFF main.ts received request on port 3000
2. CORS middleware allows it (origin check)
3. Routes to AuthModule because path is /auth/*


STEP 3: BFF Auth Controller
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Validates request format (SignupDto)
2. No JWT needed (signup is public)
3. Forwards to Auth Service at localhost:3001


STEP 4: Auth Service receives request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Auth main.ts received request on port 3001
2. Routes to auth.controller.ts
3. auth.controller calls auth.service.signup()


STEP 5: AuthService.signup() executes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Receives: { email, password }
2. Checks: email not already in use
   → Query: SELECT * FROM users WHERE email = 'alice@example.com'
   → PrismaService executes in auth_db schema
   → Database returns: no user found ✅
   
3. Hashes password using Argon2id
   Input: "SecurePassword123"
   Output: "$argon2id$v=19$m=65536,t=3,p=4$..." (impossible to reverse)
   
4. Creates user in transaction (all-or-nothing):
   INSERT INTO users (email, role, status, kycStatus, createdAt)
   VALUES ('alice@example.com', 'user', 'active', 'not_started', now())
   
5. Creates auth credential record:
   INSERT INTO auth_credentials (userId, passwordHash)
   VALUES ('user-uuid', 'hashed-password')
   
6. Creates user profile:
   INSERT INTO user_profiles (userId, ...)
   
7. JwtService.generateToken(userId)
   → Creates JWT with payload: { sub: userId, email, exp: +30min }
   → Signs with SECRET_KEY from SecretsService
   → Returns: "eyJhbGciOi..."
   
8. SessionService.createSession(userId)
   → Stores in Redis: session-key → userId (expires in 7 days)
   → Returns session token
   
9. Returns response:
   {
     "accessToken": "eyJhbGciOi...",
     "refreshToken": "refresh-token-here",
     "user": {
       "id": "user-uuid",
       "email": "alice@example.com",
       "role": "user"
     }
   }


STEP 6: BFF forwards response
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Response passes through interceptors and returns to frontend


STEP 7: Frontend receives response
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. React component receives tokens
2. Stores accessToken in localStorage/sessionStorage
3. Stores refreshToken securely
4. Redirects to dashboard
```

### **Example: Login Request**

```
Frontend
  ↓ POST /api/v1/auth/login
  ↓ { email: "alice@example.com", password: "SecurePassword123" }
  ↓
BFF (routes to Auth Service)
  ↓
Auth Service
  ↓ PrismaService queries: SELECT * FROM users WHERE email = 'alice@...'
  ↓ Finds user with ID "user-uuid"
  ↓ Gets auth_credential record with passwordHash
  ↓ Uses Argon2 to verify: hash(submitted_password) == stored_hash
  ↓ If doesn't match → throw UnauthorizedException
  ↓ If matches ✅ → generate JWT token
  ↓ Returns: { accessToken, refreshToken }
  ↓
Frontend stores tokens and uses them for authenticated requests
```

### **Example: Authenticated Request (Get Blogs)**

```
Frontend (has JWT from login)
  ↓ GET /api/v1/admin/blogs
  ↓ Header: "Authorization: Bearer eyJhbGciOi..."
  ↓
BFF (receives request)
  ↓ JwtAuthGuard.canActivate() executes
  ↓ Extracts token from header
  ↓ JwtService.validateToken(token)
  ↓   - Verifies signature (hasn't been tampered)
  ↓   - Checks expiration time
  ↓   - Extracts user ID from payload
  ↓ If valid ✅ → attaches userId to request object
  ↓ Routes to AdminModule
  ↓
Admin Service (receives authenticated request with userId)
  ↓ Blog controller receives request with user context
  ↓ Calls blogService.getAllBlogs(userId)
  ↓ PrismaService queries: SELECT * FROM blogs WHERE created_by = userId
  ↓ Returns: [{ id, title, content, createdAt }, ...]
  ↓
Returns blog list to Frontend
```

---

## 🚀 Setting Up & Running Locally

### **1. Prerequisites Check**

```bash
# Check you have Node.js
node --version
# Should show: v20.x.x or higher

# Check you have npm
npm --version
# Should show: 10.x.x or higher

# Check you have Docker
docker --version
# Should show: Docker version...
```

### **2. Start Infrastructure**

```bash
# From root (escrowly-backend/)
npm run docker:up

# Wait 30 seconds for services to start
# PostgreSQL: localhost:5433
# Redis: localhost:6379
# Redpanda: localhost:9092
# PgAdmin: http://localhost:5050
```

### **3. Setup Auth Service**

```bash
cd services/auth

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma client (connects to database)
npm run prisma:generate

# Run database migrations (creates tables)
npm run prisma:migrate:dev

# Start the service
npm run start:dev
# Running on: http://localhost:3001
```

### **4. Setup Admin Service (Optional)**

```bash
cd services/admin

npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
# Running on: http://localhost:3002
```

### **5. Start BFF Gateway (Optional)**

```bash
cd services/bff

npm install
cp .env.example .env
npm run start:dev
# Running on: http://localhost:3000
```

### **6. Test Your Setup**

```bash
# Test Auth Service
curl http://localhost:3001/api/v1/health
# Should return: { "status": "ok" }

# Test Admin Service
curl http://localhost:3002/api/v1/health
# Should return: { "status": "ok" }

# Test BFF
curl http://localhost:3000/api/v1/health
# Should return: { "status": "ok" }

# Test signup (no auth needed)
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "acceptTerms": true
  }'
```

### **7. Access Swagger Documentation**

```
Auth Service: http://localhost:3001/api/docs
Admin Service: http://localhost:3002/api/docs
BFF: http://localhost:3000/api/docs
```

### **8. Stop All Services**

```bash
npm run docker:down
```

---

## 🎯 Key Concepts Summary

| Concept | Explanation | Simple Analogy |
|---------|-------------|---|
| **Microservices** | Each service handles one job | A restaurant has kitchen, waitstaff, cashier |
| **JWT Token** | Proof of identity | Passport or ID card |
| **Database Schema** | Isolated tables within one database | Separate filing cabinets in one office |
| **BFF Gateway** | Routes requests to right service | Office receptionist directing visitors |
| **Prisma ORM** | Code to talk to database | Instead of writing SQL, use JavaScript |
| **NestJS** | Framework for building services | Structure and best practices for apps |
| **Redis** | Fast cache/memory storage | Sticky notes on your desk (vs files in cabinet) |
| **Argon2 Hashing** | One-way password encryption | You can make a smoothie but can't unblend it |
| **Secrets Manager** | Secure storage for passwords/keys | Safe deposit box for valuables |
| **CORS** | Allow frontend to talk to backend | Permission slip to access the building |

---

## 📚 Important Files at a Glance

```
Must understand these first:
1. docker-compose.yml       - What services run locally
2. package.json             - Root workspace setup
3. services/*/src/main.ts   - How each service starts

Most important logic:
4. services/auth/src/auth/auth.service.ts - Login/signup logic
5. services/auth/src/auth/jwt.service.ts  - Token creation
6. services/auth/prisma/schema.prisma     - Database structure

API Gateway:
7. services/bff/src/app.module.ts         - Request routing

Shared code:
8. packages/shared-config/src/secrets.service.ts - Secret access
```

---

## 🔗 Next Steps

1. **Run locally** - Follow "Setting Up & Running Locally" section
2. **Test endpoints** - Use Swagger docs at `/api/docs`
3. **Read code** - Pick one feature (auth, blogs) and trace the code
4. **Modify and test** - Change something, test it works
5. **Add features** - Use existing patterns to build new features

---

**Congratulations!** 🎉 You now understand the Escrowly backend system!

The key insight: Escrowly is a **secure, scalable system** for handling money/crypto safely using **proven patterns** (microservices, JWT, database schemas). Every part has a clear purpose and works together seamlessly.

