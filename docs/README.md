# Escrowly Backend Documentation

Welcome to the Escrowly Backend documentation!

## 📚 Available Guides

### Infrastructure & Monitoring
- **[Kafka Monitoring Guide](./KAFKA_MONITORING.md)** - Monitor Kafka events with Kafka UI (like Bull Board for BullMQ)

### Package Documentation
- **[kafka-core Package](../packages/kafka-core/README.md)** - Centralized Kafka infrastructure
- **[auth-common Package](../packages/auth-common/README.md)** - Shared authentication utilities

### Service Documentation
- **[Escrow Service Kafka](../services/escrow/src/kafka/README.md)** - Escrow event production

## 🚀 Quick Links

| Resource | URL | Description |
|----------|-----|-------------|
| **Kafka UI** | http://localhost:8080 | View Kafka events & topics |
| **PgAdmin** | http://localhost:5050 | Database management |
| **Mailhog** | http://localhost:8025 | Email testing |
| **Auth API** | http://localhost:3000/docs | Auth service Swagger |
| **Escrow API** | http://localhost:3004/docs | Escrow service Swagger |
| **BFF API** | http://localhost:3001/docs | Gateway Swagger |

## 🛠️ Development Setup

```bash
# 1. Start infrastructure (Postgres, Redis, Kafka)
docker-compose up -d

# 2. Start with dev tools (includes Kafka UI, PgAdmin, Mailhog)
docker-compose --profile dev up -d

# 3. Run services locally
npm run auth:dev
npm run escrow:dev
```

## 📊 Monitoring

### Kafka Events
See [KAFKA_MONITORING.md](./KAFKA_MONITORING.md) for:
- How to view produced events
- How to monitor consumers
- How to debug event flow
- Real-time event streaming

### Database
- **PgAdmin**: http://localhost:5050
- Login: `admin@escrowly.local` / `admin`

### Email Testing
- **Mailhog**: http://localhost:8025
- Catches all outgoing emails

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                   API Gateway (BFF)                  │
│                   http://localhost:3001              │
└────────────┬─────────────────────────┬───────────────┘
             │                         │
   ┌─────────▼─────────┐    ┌──────────▼──────────┐
   │  Auth Service     │    │  Escrow Service     │
   │  :3000            │    │  :3004              │
   └─────────┬─────────┘    └──────────┬──────────┘
             │                         │
             │      ┌──────────────────▼────────────┐
             │      │     Kafka (Redpanda)          │
             │      │     Events Streaming           │
             │      └──────────┬────────────────────┘
             │                 │
   ┌─────────▼─────────────────▼────────────────────┐
   │          PostgreSQL (Multi-Schema)             │
   │          auth_db | escrow_db | admin_db        │
   └────────────────────────────────────────────────┘
```

## 🔗 Related Resources

- [Main README](../README.md)
- [Project Structure](../README.md#project-structure)
- [Contributing Guidelines](../CONTRIBUTING.md) *(if exists)*

