# Escrow Service - Quick Start Guide

Complete step-by-step instructions to build and run the Escrow service.

## ✅ Prerequisites

Verify you have:

- Node.js >= 18 (`node --version`)
- npm >= 10 (`npm --version`)
- PostgreSQL >= 14 OR Docker (for docker-compose)
- Git

## 🚀 Step 1: Install Dependencies

```bash
cd services/escrow
npm install
```

**Expected Output:**

```
added XXX packages in XXs
```

## 🚀 Step 2: Setup Database

### Option A: Using Docker Compose (Recommended)

From the **project root** (`escrowly-backend`):

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Wait 30 seconds for PostgreSQL to be ready
```

Verify the container is healthy:

```bash
docker-compose ps postgres
```

Expected status: `(healthy)`

### Option B: Using Local PostgreSQL

Ensure PostgreSQL is running on your machine, then create the database:

```bash
# Connect to PostgreSQL with psql or your GUI client
psql -U postgres
```

Create the database:

```sql
CREATE DATABASE escrow_db OWNER postgres;
```

## 🚀 Step 3: Configure Environment

In the `services/escrow` directory, create or update `.env`:

### For Docker Compose Setup:

```env
DATABASE_URL="postgresql://escrowly_dev:escrowly_dev_password@localhost:5433/escrowly"
NODE_ENV=development
PORT=3001
JWT_SECRET=dev-secret-key
```

### For Local PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/escrow_db"
NODE_ENV=development
PORT=3001
JWT_SECRET=dev-secret-key
```

## 🚀 Step 4: Generate Prisma Client

```bash
cd services/escrow
npx prisma generate
```

**Expected Output:**

```
✔ Generated Prisma Client (6.x.x) to ./node_modules/@prisma/client
```

## 🚀 Step 5: Create Database Tables

```bash
npx prisma migrate dev --name init
```

**What This Does:**

1. Creates migration file in `prisma/migrations/`
2. Applies migration to database
3. Generates Prisma Client types
4. Seeds database (if seed script exists)

**Expected Output:**

```
✔ Successfully created 5 new tables

✔ Generated Prisma Client (6.x.x) in 123ms
```

Verify tables were created:

```bash
npx prisma studio  # Opens UI at http://localhost:5555
```

## 🚀 Step 6: Build the Service

```bash
npm run build
```

**Expected Output:**

```
> escrow@0.0.1 build
> nest build

Successfully compiled application
```

If you get TypeScript errors, run the cleanup commands in the Troubleshooting section below.

## 🚀 Step 7: Run the Service

### Development Mode (with hot-reload)

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start:prod
```

### Debug Mode

```bash
npm run start:debug
```

**Expected Output:**

```
[Nest] 12345  - 12/11/2025, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 12/11/2025, 10:30:01 AM     LOG [InstanceLoader] DatabaseModule dependencies initialized
[Nest] 12345  - 12/11/2025, 10:30:01 AM     LOG [InstanceLoader] EscrowModule dependencies initialized
[Nest] 12345  - 12/11/2025, 10:30:01 AM     LOG [NestFactory] Nest application successfully started
[Nest] 12345  - 12/11/2025, 10:30:01 AM     LOG [AppModule] Server running on port 3001
```

## 📚 Verify Service is Running

### Check Health Endpoint

```bash
curl http://localhost:3001/
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-12-11T10:30:00Z",
  "uptime": "2.5s"
}
```

### Access Swagger Documentation

Open in browser:

```
http://localhost:3001/docs
```

You should see the Swagger UI with all endpoints documented.

### Test Create Escrow Endpoint

```bash
curl -X POST http://localhost:3001/api/v1/escrows \
  -H "Content-Type: application/json" \
  -d '{
    "buyerId": "550e8400-e29b-41d4-a716-446655440001",
    "sellerId": "550e8400-e29b-41d4-a716-446655440002",
    "amount": 1000.5,
    "asset": "USDT",
    "chain": "eth",
    "platformFee": 10.5,
    "description": "Test escrow"
  }'
```

Expected response (201 Created):

```json
{
  "id": "uuid...",
  "buyerId": "550e8400-e29b-41d4-a716-446655440001",
  "sellerId": "550e8400-e29b-41d4-a716-446655440002",
  "amount": 1000.5,
  "asset": "USDT",
  "chain": "eth",
  "state": "agreement",
  "createdAt": "2025-12-11T10:30:00Z",
  ...
}
```

## 🔧 Troubleshooting

### Compilation Error: "Cannot find module"

```bash
# Clean and reinstall
Remove-Item -Path ./node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ./dist -Recurse -Force -ErrorAction SilentlyContinue
npm install
npx prisma generate
npm run build
```

### Database Connection Error

Verify `.env` DATABASE_URL is correct:

```bash
# Test connection
npx prisma db execute --stdin < nul
```

If that fails, check:

1. PostgreSQL is running: `docker-compose ps postgres`
2. Port is correct (5433 for docker, 5432 for local)
3. Credentials are correct in `.env`

### Migration Already Applied Error

If you see "Migration 'init' has already been applied":

```bash
# View current migration status
npx prisma migrate status

# Your database is up-to-date, you can start the service
npm run start:dev
```

### Port Already in Use

If port 3001 is already in use:

```bash
# Change PORT in .env
PORT=3002

npm run start:dev
```

## 📁 Database Management

### View All Data

```bash
npx prisma studio  # Opens http://localhost:5555
```

### Check Migration History

```bash
npx prisma migrate status
```

### Reset Database (Development Only)

```bash
# WARNING: This deletes all data!
npx prisma migrate reset
```

### Create New Migration

```bash
# After editing schema.prisma
npx prisma migrate dev --name <description>
```

## 📝 Next Steps

1. ✅ Service is running and accessible at `http://localhost:3001`
2. 📚 Explore Swagger docs at `http://localhost:3001/docs`
3. 🧪 Run tests: `npm test`
4. 🔐 Integrate JWT authentication (see [Authentication Integration](#authentication-integration))
5. 📊 Setup monitoring and logging
6. 🚀 Deploy to production

## 🆘 Still Having Issues?

1. Check [ESCROW_SERVICE_README.md](./ESCROW_SERVICE_README.md) for detailed documentation
2. Review error logs in terminal output
3. Check database connection with: `npx prisma db execute --stdin < nul`
4. Verify all services are running: `docker-compose ps`
5. Check `.env` file has all required variables

## 📞 Common Endpoints

| Method | Endpoint                         | Description           |
| ------ | -------------------------------- | --------------------- |
| GET    | `/`                              | Health check          |
| POST   | `/api/v1/escrows`                | Create escrow         |
| GET    | `/api/v1/escrows/:id`            | Get escrow details    |
| GET    | `/api/v1/escrows/user/:userId`   | Get user's escrows    |
| POST   | `/api/v1/escrows/:id/payment`    | Record payment        |
| POST   | `/api/v1/escrows/:id/delivery`   | Record delivery       |
| POST   | `/api/v1/escrows/:id/inspection` | Record inspection     |
| POST   | `/api/v1/escrows/:id/dispute`    | File dispute          |
| GET    | `/api/v1/escrows/:id/history`    | Get audit trail       |
| GET    | `/docs`                          | Swagger documentation |

---

**Need help?** Refer to the main README in the project root or check individual service documentation.
