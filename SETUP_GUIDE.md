# Escrowly Backend - Setup Guide

Complete guide to set up and run the Escrowly backend services locally.

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- ✅ **npm** >= 10.0.0 (comes with Node.js)
- ✅ **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- ✅ **Git** ([Download](https://git-scm.com/))

Verify installations:

```bash
node --version    # Should show v20.x.x or higher
npm --version     # Should show 10.x.x or higher
docker --version  # Should show Docker version info
```

---

## 🚀 Quick Start (5 Minutes)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd escrowly-backend
```

### 2. Start Local Infrastructure

```bash
npm run docker:up
```

This command starts:

- **PostgreSQL** (port 5432) - Database with all schemas
- **Redis** (port 6379) - Caching and sessions
- **Redpanda** (port 9092) - Kafka-compatible event streaming
- **Mailhog** (ports 1025, 8025) - Email testing
- **PgAdmin** (port 5050) - Database management UI

Wait ~30 seconds for all services to be healthy.

### 3. Setup Auth Service

```bash
cd services/auth
npm install
cp .env.example .env
npm run prisma:generate
```

### 4. Start Auth Service

```bash
npm run start:dev
```

✅ **You're Done!** The Auth Service is now running.

Access:

- **API**: http://localhost:3001/api
- **Swagger Docs**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api/v1/health

---

## 📊 Infrastructure Services

### PostgreSQL

**Access via PgAdmin**: http://localhost:5050

Login:

- Email: `admin@escrowly.local`
- Password: `admin`

Add server:

- Host: `postgres` (or `host.docker.internal` if not working)
- Port: `5432`
- Username: `escrowly_dev`
- Password: `escrowly_dev_password`
- Database: `escrowly`

**Schemas** (logical databases):

```
postgres
├── auth_db          ← Auth Service
├── wallet_db        ← Wallet Service (future)
├── ledger_db        ← Ledger Service (future)
├── escrow_db        ← Escrow Service (future)
├── inquiry_db       ← Inquiry Service (future)
├── compliance_db    ← Compliance Service (future)
├── admin_db         ← Admin Service (future)
└── reporting_db     ← Reporting Service (future)
```

### Redis

**Connection**: `redis://:escrowly_redis_password@localhost:6379`

Test connection:

```bash
docker exec -it escrowly-redis redis-cli -a escrowly_redis_password ping
# Should return: PONG
```

### Redpanda (Kafka)

**Broker**: `localhost:9092`
**Admin API**: http://localhost:9644

List topics:

```bash
docker exec -it escrowly-redpanda rpk topic list
```

### Mailhog (Email Testing)

**Web UI**: http://localhost:8025

All emails sent by services are captured here (no real emails sent).

---

## 🧪 Testing

### Run All Tests

```bash
cd services/auth
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Generate Coverage Report

```bash
npm run test:cov
```

Coverage report will be in `coverage/lcov-report/index.html`.

---

## 🛠️ Development Workflow

### Typical Development Flow

1. **Start infrastructure** (if not already running):

   ```bash
   npm run docker:up
   ```

2. **Work on a service** (e.g., auth):

   ```bash
   cd services/auth
   npm run start:dev
   ```

3. **Make changes** - Code will auto-reload

4. **Write tests** (TDD approach):

   ```bash
   npm run test:watch
   ```

5. **Check Swagger docs**:
   http://localhost:3001/api/docs

6. **Stop infrastructure** (when done):
   ```bash
   npm run docker:down
   ```

### Database Migrations

When you need to create a migration:

```bash
cd services/auth
npm run prisma:migrate:dev --name describe_your_changes
```

This will:

1. Generate SQL migration file
2. Apply migration to local database
3. Regenerate Prisma client

### Adding New Dependencies

```bash
cd services/auth
npm install package-name
npm install -D dev-package-name  # For dev dependencies
```

### Viewing Logs

**All services**:

```bash
npm run docker:logs
```

**Specific service**:

```bash
docker logs escrowly-postgres -f
docker logs escrowly-redis -f
docker logs escrowly-redpanda -f
```

---

## 🐛 Troubleshooting

### Docker Services Won't Start

**Solution 1**: Check if ports are already in use

```bash
# Windows
netstat -ano | findstr "5432"
netstat -ano | findstr "6379"

# Kill process if needed
taskkill /PID <process_id> /F
```

**Solution 2**: Restart Docker Desktop

**Solution 3**: Clean Docker volumes

```bash
npm run docker:clean  # ⚠️ Deletes all data
npm run docker:up
```

### Database Connection Failed

Check if PostgreSQL is running:

```bash
docker ps | grep escrowly-postgres
```

If not running, restart:

```bash
npm run docker:restart
```

### Prisma Client Not Found

Regenerate the client:

```bash
cd services/auth
npm run prisma:generate
```

### Port Already in Use (e.g., 3001)

Change port in `.env`:

```env
PORT=3002  # or any available port
```

### Tests Failing

1. Ensure all dependencies installed:

   ```bash
   npm install
   ```

2. Regenerate Prisma client:

   ```bash
   npm run prisma:generate
   ```

3. Check if test database is accessible

---

## 📁 Project Structure

```
escrowly-backend/
├── services/                 # Microservices
│   ├── auth/                 # ✅ Auth Service (READY)
│   │   ├── src/
│   │   ├── test/
│   │   ├── prisma/
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── wallet/               # 🔜 Coming soon
│   ├── ledger/               # 🔜 Coming soon
│   ├── escrow/               # 🔜 Coming soon
│   ├── bff/                  # 🔜 Coming soon
│   └── ...                   # Other services
├── infra/                    # Infrastructure as Code
│   └── cdk/
│       ├── dev/              # Dev infrastructure (minimal AWS)
│       ├── stage/            # Stage infrastructure (full stack)
│       └── prod/             # Production infrastructure
├── scripts/                  # Utility scripts
│   └── init-schemas.sql      # DB schema initialization
├── docker-compose.yml        # Local infrastructure
├── package.json              # Root workspace config
└── SETUP_GUIDE.md           # This file
```

---

## 🌍 Environment Strategy

### Local Development (Current)

- **Database**: Docker PostgreSQL
- **Cache**: Docker Redis
- **Events**: Docker Redpanda
- **Email**: Docker Mailhog
- **AWS Services**: Dummy/Mock values in `.env`

### Dev Environment (After CDK Deploy)

- **Database**: AWS Aurora Serverless v2 (tiny)
- **Cache**: Local Redis (Docker)
- **Events**: Local Redpanda (Docker)
- **AWS Services**: Real S3, KMS, Secrets Manager
- **No EKS**: Services run locally, connect to AWS resources

### Stage Environment (Future)

- **Everything in AWS**: EKS, Aurora, MSK, ElastiCache, etc.
- **Full CI/CD pipeline**: Auto-deploy on merge to `stage` branch

### Production Environment (Future)

- **High Availability**: Multi-AZ, auto-scaling
- **CI/CD**: Merge `stage` → `main` triggers deployment

---

## 📚 Next Steps

Now that your Auth Service is running, you can:

1. ✅ **Explore Swagger**: http://localhost:3001/api/docs
2. ✅ **Run Tests**: `npm test`
3. ✅ **View Database**: http://localhost:5050
4. 📖 **Read Auth Service README**: `services/auth/README.md`
5. 🚀 **Deploy Dev Infra**: (when ready) `cd infra/cdk/dev && cdk deploy`

---

## 🤝 Getting Help

- Check service-specific README files
- Review Swagger documentation
- Check Docker logs: `npm run docker:logs`
- Ensure all prerequisites are met

---

**Happy Coding! 🎉**

Last Updated: November 19, 2025
