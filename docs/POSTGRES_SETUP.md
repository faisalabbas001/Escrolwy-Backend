# PostgreSQL Setup Guide

This guide explains how to set up PostgreSQL for the Escrowly Backend project.

## Architecture

The project uses a **single PostgreSQL instance** with **multiple schemas** (one per service):

- `auth_db` - Authentication service schema
- `admin_db` - Admin service schema  
- `listener_engine_db` - Listener Engine service schema

This approach allows:
- ✅ Single database instance (easier management)
- ✅ Schema-level isolation (security)
- ✅ Independent migrations per service
- ✅ Shared connection pool

## Quick Start (Docker - Recommended)

### 1. Start PostgreSQL & Redis

```bash
# From project root
docker-compose up -d postgres redis
```

This will:
- Start PostgreSQL on port **5433** (mapped from container's 5432)
- Start Redis on port **6379**
- Automatically create all schemas via `scripts/init-schemas.sql`
- Set up health checks

### 2. Verify PostgreSQL is Running

```bash
# Check container status
docker ps | grep postgres

# Test connection
docker exec -it escrowly-postgres psql -U escrowly_dev -d escrowly -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%_db';"
```

You should see:
```
    schema_name    
-------------------
 auth_db
 admin_db
 listener_engine_db
```

### 3. Run Prisma Migrations

```bash
# Generate Prisma clients
npm run auth:prisma:generate
npm run admin:prisma:generate
npm run listener:prisma:generate

# Run migrations (if needed)
npm run auth:prisma:migrate
npm run admin:prisma:migrate
npm run listener:prisma:migrate
```

### 4. Verify Connection

```bash
# Test from listener-engine
cd services/listener-engine
npm run start:dev
```

You should see: `✅ Connected to PostgreSQL (listener_engine_db schema)`

## Configuration Details

### Docker Compose Configuration

**File**: `docker-compose.yml`

```yaml
postgres:
  image: postgres:16-alpine
  container_name: escrowly-postgres
  environment:
    POSTGRES_USER: escrowly_dev
    POSTGRES_PASSWORD: escrowly_dev_password
    POSTGRES_DB: escrowly
  ports:
    - "5433:5432"  # Host:Container
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./scripts/init-schemas.sql:/docker-entrypoint-initdb.d/init-schemas.sql
```

**Key Points**:
- Port **5433** on host (to avoid conflicts with local PostgreSQL)
- Data persisted in Docker volume `postgres_data`
- Schema initialization runs automatically on first start

### Database Connection Strings

**Format**: `postgresql://user:password@host:port/database?schema=schema_name`

**Local Development** (from host machine):
```
postgresql://escrowly_dev:escrowly_dev_password@localhost:5433/escrowly?schema=listener_engine_db
```

**Docker Services** (from other containers):
```
postgresql://escrowly_dev:escrowly_dev_password@postgres:5432/escrowly?schema=listener_engine_db
```

Note: Docker services use `postgres:5432` (container name), not `localhost:5433`

### Environment Variables

Each service's `.env` file should have:

```env
DATABASE_URL=postgresql://escrowly_dev:escrowly_dev_password@localhost:5433/escrowly?schema=listener_engine_db
```

## Manual Setup (Without Docker)

If you prefer to run PostgreSQL locally without Docker:

### 1. Install PostgreSQL

**macOS**:
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install postgresql-16
sudo systemctl start postgresql
```

### 2. Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# Run these commands:
CREATE USER escrowly_dev WITH PASSWORD 'escrowly_dev_password';
CREATE DATABASE escrowly OWNER escrowly_dev;
GRANT ALL PRIVILEGES ON DATABASE escrowly TO escrowly_dev;
\q
```

### 3. Create Schemas

```bash
# Connect to the database
psql -U escrowly_dev -d escrowly

# Run the init script
\i scripts/init-schemas.sql

# Or manually:
CREATE SCHEMA IF NOT EXISTS auth_db;
CREATE SCHEMA IF NOT EXISTS admin_db;
CREATE SCHEMA IF NOT EXISTS listener_engine_db;

GRANT ALL PRIVILEGES ON SCHEMA auth_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA admin_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA listener_engine_db TO escrowly_dev;
\q
```

### 4. Update Connection String

Update `.env` files to use port **5432** (default PostgreSQL port):

```env
DATABASE_URL=postgresql://escrowly_dev:escrowly_dev_password@localhost:5432/escrowly?schema=listener_engine_db
```

## Schema Initialization

The `scripts/init-schemas.sql` file automatically:

1. Creates all service schemas (`auth_db`, `admin_db`, `listener_engine_db`)
2. Grants privileges to the database user
3. Sets default privileges for future tables

**When it runs**:
- ✅ Automatically on first Docker container start
- ✅ Manually if running PostgreSQL locally

## Common Commands

### Docker Commands

```bash
# Start PostgreSQL & Redis
docker-compose up -d postgres redis

# View logs
docker-compose logs -f postgres

# Stop services
docker-compose stop postgres redis

# Remove containers (keeps data)
docker-compose down

# Remove containers AND data
docker-compose down -v

# Connect to PostgreSQL from host
docker exec -it escrowly-postgres psql -U escrowly_dev -d escrowly

# Backup database
docker exec escrowly-postgres pg_dump -U escrowly_dev escrowly > backup.sql

# Restore database
docker exec -i escrowly-postgres psql -U escrowly_dev -d escrowly < backup.sql
```

### Database Management

```bash
# List all schemas
psql -U escrowly_dev -d escrowly -c "\dn"

# List tables in a schema
psql -U escrowly_dev -d escrowly -c "\dt listener_engine_db.*"

# View listener_state table
psql -U escrowly_dev -d escrowly -c "SELECT * FROM listener_engine_db.listener_state;"

# Reset a schema (⚠️ deletes all data)
psql -U escrowly_dev -d escrowly -c "DROP SCHEMA listener_engine_db CASCADE; CREATE SCHEMA listener_engine_db;"
```

### Prisma Commands

```bash
# Generate Prisma client
npm run listener:prisma:generate

# Create new migration
npm run listener:prisma:migrate

# Apply migrations (production)
npm run listener:prisma:migrate:deploy

# Open Prisma Studio (GUI)
npm run listener:prisma:studio
```

## Troubleshooting

### Connection Refused

**Error**: `P1001: Can't reach database server`

**Solutions**:
1. Check if PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   # or
   brew services list | grep postgresql
   ```

2. Verify port is correct:
   - Docker: `localhost:5433`
   - Local: `localhost:5432`

3. Check firewall/network settings

### Schema Not Found

**Error**: `schema "listener_engine_db" does not exist`

**Solutions**:
1. Run init script:
   ```bash
   docker exec -i escrowly-postgres psql -U escrowly_dev -d escrowly < scripts/init-schemas.sql
   ```

2. Or manually create schema:
   ```sql
   CREATE SCHEMA IF NOT EXISTS listener_engine_db;
   GRANT ALL PRIVILEGES ON SCHEMA listener_engine_db TO escrowly_dev;
   ```

### Permission Denied

**Error**: `permission denied for schema`

**Solution**:
```sql
GRANT ALL PRIVILEGES ON SCHEMA listener_engine_db TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA listener_engine_db GRANT ALL ON TABLES TO escrowly_dev;
```

### Port Already in Use

**Error**: `port 5433 is already in use`

**Solutions**:
1. Find what's using the port:
   ```bash
   lsof -i :5433
   ```

2. Change port in `docker-compose.yml`:
   ```yaml
   ports:
     - "5434:5432"  # Use different port
   ```

3. Update `.env` files with new port

## Production Setup

For production (AWS Aurora), see:
- `packages/shared-config/README.md` - Secrets management
- `infra/cdk/` - Infrastructure as Code
- `scripts/aurora-preserved/` - Aurora-specific scripts

Production uses:
- AWS Secrets Manager for credentials
- Dynamic credential fetching
- Automatic credential rotation

## Next Steps

After PostgreSQL is running:

1. ✅ Verify schemas exist
2. ✅ Run Prisma migrations
3. ✅ Test connection from services
4. ✅ Start your services

```bash
# Start all infrastructure
docker-compose up -d postgres redis

# Start services
npm run auth:dev
npm run admin:dev
npm run listener:dev  # or use tmux script
```

