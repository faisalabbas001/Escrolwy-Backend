# Docker Commands Quick Reference

> **Correct Docker Compose commands for this project**

---

## Important: Use `docker compose` (not `docker-compose`)

Modern Docker installations include Docker Compose as a **plugin**, so use:
- ✅ `docker compose` (with **space**)
- ❌ `docker-compose` (with **hyphen** - old standalone version)

---

## Quick Commands

### Start Services

```bash
# Start all services
docker compose up -d

# Start specific services
docker compose up -d postgres redis auth-service inquiry-service bff-service

# Start with rebuild
docker compose up -d --build
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (⚠️ deletes data)
docker compose down -v
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f bff-service
docker compose logs -f inquiry-service
docker compose logs -f auth-service

# Last 100 lines
docker compose logs --tail=100 bff-service
```

### Check Status

```bash
# List all services
docker compose ps

# Check specific service
docker compose ps bff-service
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart bff-service
```

### Execute Commands

```bash
# Run command in service container
docker compose exec bff-service sh
docker compose exec bff-service env | grep JWT_SECRET

# Run one-off command
docker compose run --rm bff-service npm test
```

### View Configuration

```bash
# Validate docker-compose.yml
docker compose config

# See environment variables
docker compose config | grep JWT_SECRET
```

---

## Common Workflows

### Starting Development Environment

```bash
# 1. Start infrastructure (PostgreSQL, Redis)
docker compose up -d postgres redis

# 2. Wait for services to be ready (30 seconds)
sleep 30

# 3. Start application services
docker compose up -d auth-service inquiry-service bff-service

# 4. Check logs
docker compose logs -f bff-service
```

### Restarting After Code Changes

```bash
# Rebuild and restart BFF
docker compose up -d --build bff-service

# Or restart without rebuild (if no code changes)
docker compose restart bff-service
```

### Debugging

```bash
# View all logs
docker compose logs

# Follow logs for specific service
docker compose logs -f bff-service

# Check service status
docker compose ps

# Check environment variables
docker compose exec bff-service env

# Access container shell
docker compose exec bff-service sh
```

### Clean Reset

```bash
# Stop all services
docker compose down

# Remove containers, networks, and volumes
docker compose down -v

# Rebuild and start
docker compose up -d --build
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs bff-service

# Check if port is already in use
lsof -i :3001

# Check service status
docker compose ps
```

### Changes Not Reflecting

```bash
# Rebuild service
docker compose up -d --build bff-service

# Or restart
docker compose restart bff-service
```

### Service Health Check

```bash
# Check health endpoints
curl http://localhost:3001/api/v1/health
curl http://localhost:3000/api/v1/health
curl http://localhost:3003/api/v1/health
```

---

## Migration from docker-compose

If you have scripts using `docker-compose` (hyphen), you can:

### Option 1: Create Alias (Temporary)

```bash
# Add to ~/.bashrc or ~/.zshrc
alias docker-compose='docker compose'

# Reload shell
source ~/.bashrc
```

### Option 2: Update Scripts

Replace all instances of `docker-compose` with `docker compose` in scripts.

### Option 3: Install Legacy docker-compose (Not Recommended)

```bash
# Only if you need compatibility
sudo apt install docker-compose
```

⚠️ **Note**: Using the plugin (`docker compose`) is recommended.

---

## Verify Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Both should show version numbers
```

---

**Last Updated**: 2024

