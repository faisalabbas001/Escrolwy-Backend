# Reporting Service

**READ-ONLY** analytics, monitoring, and alerting service for the Escrowly platform.

## Table of Contents

- [Overview](#overview)
- [S2S Authentication](#s2s-authentication)
- [Service Responsibilities](#service-responsibilities)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Health Monitoring & Cron Jobs](#health-monitoring--cron-jobs)
- [Database Schema](#database-schema)
- [Folder Structure](#folder-structure)
- [Kafka Architecture](#kafka-architecture)
- [API Endpoints](#api-endpoints)
- [Data Flow Examples](#data-flow-examples)
- [Environment Variables](#environment-variables)
- [Testing](#testing)

---

## Overview

The **Reporting Service** is a cross-domain observer service that consumes events from all microservices via Kafka, aggregates data into read-optimized tables, and provides analytics APIs for dashboards, monitoring, and compliance reporting.

### Key Characteristics

✅ **READ-ONLY**: Never mutates source systems (Auth, Wallet, Escrow, Ledger, Compliance)  
✅ **Event-Driven**: Consumes Kafka events to build materialized views  
✅ **Aggregation-First**: Pre-aggregates data into `daily_metrics` for fast queries  
✅ **Audit Trail**: Maintains `audit_snapshots` for compliance and forensics  
✅ **Alert Management**: Monitors system health and triggers alerts  
✅ **Failure Tracking**: Persists failed Kafka events for replay/analysis  

### Critical Constraints

❌ **No Business Logic**: Does not implement domain rules (those belong to source services)  
❌ **No Mutations**: Cannot create users, wallets, escrows, or transactions  
❌ **No Money Movement**: Cannot initiate deposits, withdrawals, or transfers  

---

## S2S Authentication

**All endpoints (except `/health`) require service-to-service authentication.**

The Reporting Service uses the `ServiceAuthGuard` to ensure only authenticated internal services can access its APIs.

### Required Headers

Every request must include:

```http
X-Service-Api-Key: your-service-api-key
X-Service-Id: calling-service-name
```

### Example Request

```bash
curl -H "X-Service-Api-Key: your-service-api-key" \
     -H "X-Service-Id: admin-service" \
     http://localhost:3007/api/v1/reports/escrows/summary
```

### Configuration

Set `SERVICE_API_KEY` in `.env` (must match across all services):

```env
SERVICE_API_KEY=your-secure-service-api-key-here
```

> [!IMPORTANT]
> **Production**: Store `SERVICE_API_KEY` in AWS Secrets Manager, not in `.env` files.

### Public Endpoints

The following endpoints remain **public** for external monitoring:
- `GET /api/v1/health`
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

### Authentication Flow

```
1. Client sends request with X-Service-Api-Key header
   └─> ServiceAuthGuard intercepts request

2. Guard validates API key against SERVICE_API_KEY
   ├─> If valid: Attach service context to request
   └─> If invalid: Return 401 Unauthorized

3. Request proceeds to controller
   └─> Service logic executes
```

---

## Service Responsibilities

### What This Service DOES

1. **Consumes Kafka Events** from:
   - `wallet.events` (deposits, withdrawals)
   - `compliance.events` (KYC verifications)
   - `ledger.events` (ledger entries) *(planned)*
   - `escrow.events` (escrow state changes) *(planned)*
   - `admin.events` (admin actions) *(planned)*

2. **Aggregates Data** into:
   - `daily_metrics`: Daily business metrics (deposits, withdrawals, escrows, fees)
   - `audit_snapshots`: Event-level audit trail for compliance
   - `system_metrics`: Infrastructure health (listener lag, Kafka metrics)
   - `alerts`: Active and historical alerts
   - `kafka_failures`: Failed event DLQ (Dead Letter Queue) persistence

3. **Provides Read APIs** for:
   - Escrow summary and trends
   - Transaction volume analysis
   - Fee collection reports
   - KYC distribution
   - Wallet deposit/withdrawal analytics
   - System health metrics
   - Alert management

### What This Service DOES NOT DO

- ❌ Does not own user, wallet, escrow, or ledger data
- ❌ Does not validate business rules (e.g., KYC requirements, balance checks)
- ❌ Does not publish events that trigger state changes in other services
- ❌ Does not perform real-time calculations (uses pre-aggregated data)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REPORTING SERVICE (Port 3007)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Reports    │  │   Metrics    │  │    Alerts    │  │   Exports    │   │
│  │  Controller  │  │  Controller  │  │  Controller  │  │  Controller  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         └─────────────────┴─────────────────┴─────────────────┘            │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │  Aggregation    │                               │
│                           │    Service      │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│         ┌──────────────────────────┴──────────────────────────┐             │
│         │                                                     │             │
│  ┌──────▼──────┐                                     ┌───────▼───────┐     │
│  │   Prisma    │                                     │     Kafka     │     │
│  │  (Read DB)  │                                     │   Consumers   │     │
│  └─────────────┘                                     └───────┬───────┘     │
│                                                              │             │
│                                                   ┌──────────▼──────────┐  │
│                                                   │  Event Handlers:    │  │
│                                                   │  - Wallet Deposit   │  │
│                                                   │  - Wallet Withdrawal│  │
│                                                   │  - KYC Verification │  │
│                                                   │  - Ledger Entry     │  │
│                                                   │  - Escrow Event     │  │
│                                                   │  - Admin Audit      │  │
│                                                   └─────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
              │                                        │
              ▼                                        ▼
   ┌─────────────────────┐                  ┌─────────────────────┐
   │   reporting_db      │                  │       Kafka         │
   │   (PostgreSQL)      │                  │     (Redpanda)      │
   │                     │                  │                     │
   │  - daily_metrics    │                  │  Topics:            │
   │  - system_metrics   │                  │  - wallet.events    │
   │  - alerts           │                  │  - compliance.events│
   │  - alert_rules      │                  │  - ledger.events    │
   │  - audit_snapshots  │                  │  - escrow.events    │
   └─────────────────────┘                  └─────────────────────┘
```

### Data Flow

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Wallet       │         │ Compliance   │         │ Ledger       │
│ Service      │         │ Service      │         │ Service      │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ Publishes              │ Publishes              │ Publishes
       │ wallet.events          │ compliance.events      │ ledger.events
       │                        │                        │
       └────────────────────────┴────────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │     Kafka     │
                        │   (Topics)    │
                        └───────┬───────┘
                                │
                                │ Consumes
                                ▼
                    ┌──────────────────────┐
                    │ Reporting Consumer   │
                    │ (reporting.consumer) │
                    └──────────┬───────────┘
                               │
                               │ Routes to handlers
                               ▼
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐          ┌────────▼─────────┐
        │ Event Handlers │          │ Event Validators │
        │ (Process data) │          │ (Validate schema)│
        └───────┬────────┘          └──────────────────┘
                │
                │ Calls
                ▼
        ┌───────────────────┐
        │ Aggregation       │
        │ Service           │
        │ - recordDeposit() │
        │ - recordEscrow()  │
        │ - createAudit()   │
        └───────┬───────────┘
                │
                │ Writes to
                ▼
        ┌───────────────────┐
        │ reporting_db      │
        │ (PostgreSQL)      │
        └───────────────────┘
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Create database schema
npm run prisma:migrate:dev

# Start development server
npm run start:dev

# Access Swagger documentation
open http://localhost:3007/api/docs
```

---

## Health Monitoring & Cron Jobs

The Reporting Service runs automated monitoring jobs to ensure system health and trigger alerts.

### 1. Service Health Monitoring (Every 1 Minute)

**Purpose**: Monitor health of all internal services

**Schedule**: `@Cron(CronExpression.EVERY_MINUTE)` - Runs every 1 minute

**Services Monitored**:
<!-- http://wallet-service/api/v1/health/live -->
- `auth` (port 3000) - `/api/v1/health/live`
- `admin` (port 3001) - `/api/v1/health/live`
- `escrow` (port 3002) - `/api/v1/health/live`
- `ledger` (port 3003) - `/api/v1/health/live`
- `compliance` (port 3004) - `/api/v1/health/live`
- `inquiry` (port 3005) - `/api/v1/health/live`
- `bff` (port 3006) - `/api/v1/health/live`

**How It Works**:
1. Cron job triggers every minute
2. Checks all services in parallel (non-blocking)
3. If service is DOWN (no response or non-200 status):
   - Creates `SERVICE_DOWN` alert (CRITICAL severity)
   - Publishes alert to notification service via Kafka
4. Alert cooldown: 5 minutes (prevents spam)

**Implementation**: [`src/monitoring/service-health-monitor.service.ts`](file:///home/faisal-ababs/WeiBlocks/NestJS%20/escrowly-backend/services/reporting/src/monitoring/service-health-monitor.service.ts)

**Alert Generated**:
```json
{
  "alertType": "SERVICE_DOWN",
  "source": "auth",
  "severity": "CRITICAL",
  "description": "Service auth is DOWN (connection_refused)",
  "metadata": {
    "serviceName": "auth",
    "servicePort": 3000,
    "healthEndpoint": "/api/v1/health/live",
    "failureReason": "connection_refused",
    "timestamp": "2025-12-31T12:00:00Z"
  }
}
```

---

### 2. Wallet Balance Monitoring (Hot + Funding)

**Purpose**: Monitor Hot and Funding wallet balances across all chains and alert if critically low.

**Schedule**: `@Cron('0 */3 * * *')` - Runs every 3 hours at minute 0

**Threshold**: 5000 (configurable via `WALLET_BALANCE_ALERT_THRESHOLD`)

**How It Works**:
1. Cron job triggers every 3 hours.
2. Calls Wallet Service API directly: `GET /api/v1/wallets/platform/balances`.
3. Evaluates balances against threshold (5000):
4. Evaluates balances against threshold (5000):
   - **Hot Wallet**: Checks **Native** and **Token** balances.
   - **Funding Wallet**: Checks **Native** balance only.
5. If any balance < threshold:
   - Creates `LOW_WALLET_BALANCE` alert (CRITICAL severity).
   - Publishes alert to notification service.

**Implementation**: [`src/monitoring/hot-wallet-monitor.service.ts`](file:///home/faisal-ababs/WeiBlocks/NestJS%20/escrowly-backend/services/reporting/src/monitoring/hot-wallet-monitor.service.ts)

**Alert Generated**:
```json
{
  "alertType": "LOW_WALLET_BALANCE",
  "source": "wallet-monitor",
  "severity": "CRITICAL",
  "description": "HOT wallet ETH balance on ETH is low: 4.39 (threshold: 5000)",
  "metadata": {
    "walletType": "hot",
    "chain": "eth",
    "asset": "ETH",
    "currentBalance": 4.39,
    "threshold": 5000,
    "deficit": 4995.61,
    "timestamp": "2026-01-01T12:00:00Z"
  }
}
```

---

### 3. Ledger Mismatch Consumer (Real-time)

**Purpose**: Consume ledger mismatch events and generate alerts

**Kafka Topic**: `ledger.events`

**Event Type**: `ledger.mismatch`

**How It Works**:
1. Ledger service detects balance mismatch
2. Publishes event to `ledger.events` topic
3. Reporting service consumes event via `LedgerMismatchHandler`
4. Handler:
   - Creates audit snapshot for compliance
   - Generates `LEDGER_MISMATCH` alert (HIGH severity)
   - Publishes alert to notification service

**Implementation**: [`src/kafka/consumers/handlers/ledger-mismatch.handler.ts`](file:///home/faisal-ababs/WeiBlocks/NestJS%20/escrowly-backend/services/reporting/src/kafka/consumers/handlers/ledger-mismatch.handler.ts)

**Alert Generated**:
```json
{
  "alertType": "LEDGER_MISMATCH",
  "source": "ledger-service",
  "severity": "HIGH",
  "description": "Ledger mismatch detected for user user_123: expected 1000 USD, actual 950 USD, difference -50 USD",
  "metadata": {
    "userId": "user_123",
    "expectedBalance": 1000,
    "actualBalance": 950,
    "difference": -50,
    "currency": "USD",
    "eventId": "evt_456",
    "timestamp": "2025-12-31T12:00:00Z"
  }
}
```

---

### Alert Types Summary

| Alert Type | Trigger | Frequency | Severity | Notification |
|------------|---------|-----------|----------|--------------|
| `SERVICE_DOWN` | Service health check fails | Every 1 minute | CRITICAL | Slack, Email |
| `LOW_HOT_WALLET_BALANCE` | Balance < 5000 | Every 3 hours | CRITICAL | Slack, Email, SMS |
| `HOT_WALLET_CHECK_FAILED` | Failed to fetch balance | Every 3 hours | HIGH | Slack, Email |
| `LEDGER_MISMATCH` | Ledger event received | Real-time | HIGH | Slack, Email |

---

### Configuration

Add to `.env`:

```env
# Monitoring Configuration
HEALTH_CHECK_TIMEOUT_MS=5000
HOT_WALLET_BALANCE_THRESHOLD=5000
ADMIN_SERVICE_URL=http://localhost:3001
```

---

## Database Schema

The Reporting Service uses a dedicated `reporting_db` schema with **6 core tables**:

### 1. `daily_metrics`
**Purpose**: Daily aggregated business metrics  
**Populated By**: Kafka event handlers via `AggregationService`  
**Data Source**: Aggregated from `wallet.events`, `ledger.events`, `escrow.events`

| Column | Type | Description |
|--------|------|-------------|
| `date` | Date | Unique date (YYYY-MM-DD) |
| `total_deposits` | Decimal | Sum of all deposits for the day |
| `total_withdrawals` | Decimal | Sum of all withdrawals for the day |
| `total_internal_transfers` | Decimal | Sum of internal transfers |
| `escrow_created` | Integer | Count of escrows created |
| `escrow_completed` | Integer | Count of escrows completed |
| `escrow_disputed` | Integer | Count of escrows disputed |
| `escrow_refunded` | Integer | Count of escrows refunded |
| `fees_collected` | Decimal | Total fees collected |
| `volume_by_currency` | JSON | Currency breakdown `{BTC: {volume: 10.5, count: 5}}` |

### 2. `system_metrics`
**Purpose**: System and infrastructure health metrics  
**Populated By**: External monitoring services, listener health checks  
**Data Source**: Wallet listeners, Kafka lag monitors

| Column | Type | Description |
|--------|------|-------------|
| `service_name` | Text | Service identifier (e.g., `wallet-listener`) |
| `metric_type` | Text | Metric type (e.g., `listener_lag`, `kafka_events`) |
| `metric_value` | Decimal | Numeric metric value |
| `chain` | Text | Blockchain chain (ETH, BTC, POLYGON) |

### 3. `alerts`
**Purpose**: Active and historical alerts  
**Populated By**: Alert handlers, system monitors  
**Data Source**: Triggered by `alert_rules` thresholds

| Column | Type | Description |
|--------|------|-------------|
| `alert_type` | Text | Alert category (e.g., `LISTENER_LAG`, `ESCROW_STUCK`) |
| `source` | Text | Originating service or component |
| `severity` | Text | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `description` | Text | Human-readable alert message |
| `status` | Text | `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED` |
| `metadata` | JSON | Additional context data |

### 4. `alert_rules`
**Purpose**: Configurable alert thresholds  
**Populated By**: Manual configuration, admin API  
**Data Source**: Predefined rules, admin updates

| Column | Type | Description |
|--------|------|-------------|
| `rule_type` | Text | Rule identifier (e.g., `LISTENER_LAG`) |
| `condition_expression` | Text | Condition (e.g., `block_lag > 100`) |
| `threshold` | Decimal | Numeric threshold value |
| `severity` | Text | Alert severity level |
| `action` | Text | Action to take (e.g., `slack,email`) |
| `is_active` | Boolean | Whether rule is enabled |

### 5. `audit_snapshots`
**Purpose**: Compliance and audit trail  
**Populated By**: Kafka event handlers  
**Data Source**: All significant events from all services

| Column | Type | Description |
|--------|------|-------------|
| `event_type` | Text | Event category (e.g., `deposit`, `kyc`, `admin_action`) |
| `reference_id` | Text | ID of related entity (txHash, escrowId, userId) |
| `user_id` | UUID | User who triggered the event |
| `amount` | Decimal | Transaction amount (if applicable) |
| `metadata` | JSON | Full event payload for forensics |

### 6. `kafka_failures`
**Purpose**: Dead Letter Queue (DLQ) for failed events  
**Populated By**: Kafka failure topics (`*.failed`)  
**Data Source**: All services publishing failure events

| Column | Type | Description |
|--------|------|-------------|
| `topic` | Text | Source topic of failure |
| `partition` | Integer | Kafka partition |
| `offset` | BigInt | Kafka offset |
| `consumer_group` | Text | Consumer group that failed |
| `error` | Text | Error message/stack trace |
| `event_payload` | JSON | Original event data for replay |
| `status` | Text | `PENDING`, `REPLAYED`, `IGNORED` |

---

## Folder Structure

```
src/
├── aggregation/                    # Data aggregation service
│   ├── aggregation.service.ts      # Core aggregation logic
│   ├── aggregation.module.ts       # Module definition
│   └── index.ts                    # Barrel export
│
├── alerts/                         # Alert management
│   ├── dto/                        # Data transfer objects
│   │   └── index.ts                # Alert DTOs
│   ├── alerts.controller.ts        # Alert API endpoints
│   ├── alerts.service.ts           # Alert business logic
│   ├── alerts.module.ts            # Module definition
│   └── index.ts                    # Barrel export
│
├── exports/                        # Data export functionality
│   ├── dto/                        # Export DTOs
│   ├── exports.controller.ts       # Export API endpoints
│   ├── exports.service.ts          # Export logic (S3, data lake)
│   ├── exports.module.ts           # Module definition
│   └── index.ts                    # Barrel export
│
├── health/                         # Health check endpoints
│   ├── health.controller.ts        # Health API
│   ├── health.service.ts           # Health check logic
│   ├── health.module.ts            # Module definition
│   └── index.ts                    # Barrel export
│
├── kafka/                          # Kafka infrastructure
│   ├── consumers/                  # Kafka consumers
│   │   ├── handlers/               # Event handlers
│   │   │   ├── admin-audit.handler.ts
│   │   │   ├── escrow-event.handler.ts
│   │   │   ├── inquiry-resolved.handler.ts
│   │   │   ├── kyc-verification.handler.ts
│   │   │   ├── ledger-entry.handler.ts
│   │   │   ├── wallet-deposit.handler.ts
│   │   │   ├── wallet-withdrawal.handler.ts
│   │   │   ├── event-handler.interface.ts
│   │   │   └── index.ts
│   │   ├── validators/             # Event validators
│   │   │   ├── event-validator.service.ts
│   │   │   └── index.ts
│   │   ├── reporting.consumer.ts   # Main consumer orchestrator
│   │   └── index.ts
│   ├── repository/                 # Kafka repository pattern
│   ├── kafka-events.module.ts      # Kafka module configuration
│   ├── prisma-outbox.adapter.ts    # Outbox pattern adapter
│   ├── reporting-event.producer.ts # Event producer (for alerts)
│   └── index.ts
│
├── metrics/                        # System metrics
│   ├── dto/                        # Metrics DTOs
│   ├── metrics.controller.ts       # Metrics API endpoints
│   ├── metrics.service.ts          # Metrics aggregation logic
│   ├── metrics.module.ts           # Module definition
│   └── index.ts                    # Barrel export
│
├── prisma/                         # Database service
│   ├── prisma.service.ts           # Prisma client wrapper
│   ├── prisma.module.ts            # Module definition
│   └── index.ts                    # Barrel export
│
├── reports/                        # Report generation
│   ├── dto/                        # Report DTOs
│   ├── reports.controller.ts       # Report API endpoints
│   ├── reports.service.ts          # Report query logic
│   ├── reports.module.ts           # Module definition
│   └── index.ts                    # Barrel export
│
├── app.module.ts                   # Root application module
├── app.controller.ts               # Root controller
├── app.service.ts                  # Root service
└── main.ts                         # Application bootstrap
```

### Folder Responsibilities

#### `aggregation/`
**Purpose**: Centralized data aggregation logic  
**Responsibility**: Provides methods to update `daily_metrics`, `audit_snapshots`, and `system_metrics`  
**Called By**: Kafka event handlers  
**Key Methods**:
- `recordDeposit(amount, currency)` - Increments daily deposit metrics
- `recordWithdrawal(amount, currency)` - Increments daily withdrawal metrics
- `recordEscrowCreated()` - Increments escrow created count
- `createAuditSnapshot(data)` - Creates audit trail entry

#### `kafka/consumers/`
**Purpose**: Kafka event consumption and routing  
**Responsibility**: Subscribes to Kafka topics, validates events, routes to handlers  
**Architecture**:
- `reporting.consumer.ts` - Orchestrates subscriptions and routing
- `handlers/` - Domain-specific event processors
- `validators/` - Event schema validation

#### `reports/`
**Purpose**: Read-optimized report generation  
**Responsibility**: Queries pre-aggregated data from `daily_metrics` and `audit_snapshots`  
**Data Source**: `reporting_db` (NOT source service databases)  
**Key Queries**:
- Escrow summary: Aggregates from `daily_metrics.escrow_*`
- Transaction volume: Aggregates from `daily_metrics.volume_by_currency`
- KYC distribution: Aggregates from `audit_snapshots` where `event_type = 'kyc'`

#### `metrics/`
**Purpose**: System health and infrastructure monitoring  
**Responsibility**: Queries `system_metrics` table for operational insights  
**Data Source**: Populated by external monitoring services (wallet listeners, Kafka lag monitors)

#### `alerts/`
**Purpose**: Alert management and anomaly detection  
**Responsibility**: Manages `alerts` and `alert_rules` tables  
**Key Features**:
- Acknowledge alerts
- Update alert rules
- Query alert history

#### `exports/`
**Purpose**: Data export for analytics and compliance  
**Responsibility**: Exports `daily_metrics` to S3/data lake  
**Use Cases**: Business intelligence, regulatory reporting, data warehousing

---

## Kafka Architecture

### Kafka Folder Structure

The Reporting Service follows the **same Kafka structure** as the Auth Service for consistency:

```
kafka/
├── consumers/
│   ├── handlers/                   # Event-specific handlers
│   │   ├── wallet-deposit.handler.ts
│   │   ├── wallet-withdrawal.handler.ts
│   │   ├── kyc-verification.handler.ts
│   │   ├── ledger-entry.handler.ts
│   │   ├── escrow-event.handler.ts
│   │   ├── admin-audit.handler.ts
│   │   ├── inquiry-resolved.handler.ts
│   │   ├── event-handler.interface.ts
│   │   └── index.ts
│   ├── validators/                 # Event validators
│   │   ├── event-validator.service.ts
│   │   └── index.ts
│   ├── reporting.consumer.ts       # Main consumer
│   └── index.ts
├── repository/                     # Repository pattern (if needed)
├── kafka-events.module.ts          # Kafka module
├── prisma-outbox.adapter.ts        # Outbox pattern
├── reporting-event.producer.ts     # Producer (for alerts)
└── index.ts
```

### Consumed Topics

| Topic | Event Type | Handler | Data Source | Action |
|-------|-----------|---------|-------------|--------|
| `wallet.events` | `wallet.deposit.detected` | `WalletDepositHandler` | Wallet Service | Create audit snapshot |
| `wallet.events` | `wallet.withdrawal.completed` | `WalletWithdrawalHandler` | Wallet Service | Create audit snapshot, check for failures |
| `compliance.events` | `compliance.kyc.updated` | `KycVerificationHandler` | Compliance Service | Track KYC status changes |
| `ledger.events` | `ledger.entry.created` | `LedgerEntryHandler` | Ledger Service | Update daily metrics (deposits/withdrawals) |
| `escrow.events` | `escrow.*` | `EscrowEventHandler` | Escrow Service | Update escrow metrics (created/completed/disputed) |
| `admin.events` | `admin.audit.logged` | `AdminAuditHandler` | Auth Service | Create audit snapshot for admin actions |
| `inquiry.events` | `inquiry.resolved` | `InquiryResolvedHandler` | Support Service | Track inquiry resolutions |
| `compliance.failure` | `*` | `KafkaFailureHandler` | Compliance Service | Log failed compliance events |
| `notification.*.failed` | `*` | `KafkaFailureHandler` | Notification Service | Log failed notifications |

### Produced Topics

| Topic | When | Payload | Consumers |
|-------|------|---------|-----------|
| `alert.triggered` | Alert created | `{ alertId, type, severity, description }` | Notification Service |

### Event Flow Example

```
┌─────────────────────────────────────────────────────────────────────┐
│ Example: Wallet Deposit Event Flow                                 │
└─────────────────────────────────────────────────────────────────────┘

1. Wallet Service detects on-chain deposit
   └─> Publishes to `wallet.events` topic
       {
         "metadata": {
           "eventId": "evt_123",
           "eventType": "wallet.deposit.detected",
           "timestamp": "2025-12-30T10:00:00Z"
         },
         "payload": {
           "userId": "user_456",
           "txHash": "0xabc...",
           "amount": "1.5",
           "currency": "ETH",
           "chain": "ETHEREUM"
         }
       }

2. Reporting Consumer receives event
   └─> Routes to `WalletDepositHandler`

3. WalletDepositHandler processes event
   ├─> Validates event schema (EventValidatorService)
   └─> Calls AggregationService.createAuditSnapshot()
       {
         "eventType": "deposit",
         "referenceId": "0xabc...",
         "userId": "user_456",
         "amount": 1.5,
         "metadata": { ...full payload... }
       }

4. AggregationService writes to database
   └─> INSERT INTO audit_snapshots (...)

5. Result: Audit trail created for compliance queries
```

### Handler Responsibilities

Each handler implements the `IEventHandler<T>` interface:

```typescript
interface IEventHandler<T> {
  handle(event: BaseEvent<T>): Promise<void>;
}
```

**Handler Pattern**:
1. **Validate** event schema using `EventValidatorService`
2. **Extract** relevant data from event payload
3. **Call** `AggregationService` methods to update database
4. **Log** success or error with correlation ID

**Example Handler**:
```typescript
@Injectable()
export class WalletDepositHandler implements IEventHandler<WalletEventPayloads> {
  async handle(event: BaseEvent<WalletEventPayloads>): Promise<void> {
    // 1. Validate
    if (!this.validator.validate(event, 'WALLET_DEPOSIT')) {
      return;
    }

    // 2. Extract
    const { amount, currency, userId, txHash } = event.payload;

    // 3. Aggregate
    await this.aggregation.createAuditSnapshot({
      eventType: 'deposit',
      referenceId: txHash,
      userId,
      amount: Number(amount),
      metadata: event.payload,
    });

    // 4. Log
    this.logger.log(`Processed wallet deposit: ${txHash}`);
  }
}
```

---

## API Endpoints

All endpoints require **JWT authentication** via `Authorization: Bearer <token>` header.

### Health Endpoints (3)

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/v1/health` | Basic health check | `{ status: 'ok', timestamp: '...' }` |
| GET | `/api/v1/health/ready` | Readiness probe (DB + Kafka) | `{ status: 'ready', checks: {...} }` |
| GET | `/api/v1/health/live` | Liveness probe | `{ status: 'alive' }` |

---

### Reports - Escrow & Transactions (5)

#### 1. GET `/api/v1/reports/escrows/summary`

**Purpose**: Get aggregated escrow statistics  
**Data Source**: `daily_metrics` table (aggregated from `escrow.events`)  
**Query Parameters**:
- `startDate` (optional): Start date (YYYY-MM-DD), defaults to 30 days ago
- `endDate` (optional): End date (YYYY-MM-DD), defaults to today

**Request Flow**:
```
1. Client → GET /api/v1/reports/escrows/summary?startDate=2025-12-01&endDate=2025-12-31
2. JwtAuthGuard validates token
3. ReportsController.getEscrowSummary(query)
4. ReportsService.getEscrowSummary(query)
   ├─> Queries daily_metrics WHERE date BETWEEN startDate AND endDate
   ├─> Aggregates: SUM(escrow_created), SUM(escrow_completed), etc.
   └─> Returns aggregated totals
5. Response: { totalCreated: 150, totalCompleted: 120, ... }
```

**Response**:
```json
{
  "totalCreated": 150,
  "totalCompleted": 120,
  "totalDisputed": 5,
  "totalRefunded": 10,
  "completionRate": 80.0,
  "disputeRate": 3.3,
  "period": {
    "startDate": "2025-12-01",
    "endDate": "2025-12-31"
  }
}
```

#### 2. GET `/api/v1/reports/escrows/trends`

**Purpose**: Get daily escrow trend data  
**Data Source**: `daily_metrics` table (grouped by date)  
**Query Parameters**: Same as summary

**Request Flow**:
```
1. Client → GET /api/v1/reports/escrows/trends?startDate=2025-12-01
2. JwtAuthGuard validates token
3. ReportsService.getEscrowTrends(query)
   ├─> Queries daily_metrics WHERE date >= startDate
   ├─> Groups by date
   └─> Returns array of daily metrics
4. Response: [{ date: '2025-12-01', created: 5, completed: 3 }, ...]
```

**Response**:
```json
[
  {
    "date": "2025-12-01",
    "created": 5,
    "completed": 3,
    "disputed": 0,
    "refunded": 1
  },
  {
    "date": "2025-12-02",
    "created": 8,
    "completed": 6,
    "disputed": 1,
    "refunded": 0
  }
]
```

#### 3. GET `/api/v1/reports/transactions/volume`

**Purpose**: Get transaction volume metrics by currency  
**Data Source**: `daily_metrics.volume_by_currency` (JSON aggregation)  
**Query Parameters**: `startDate`, `endDate`

**Request Flow**:
```
1. Client → GET /api/v1/reports/transactions/volume
2. ReportsService.getTransactionVolume(query)
   ├─> Queries daily_metrics.volume_by_currency
   ├─> Aggregates by currency across date range
   └─> Returns currency breakdown
3. Response: [{ currency: 'ETH', volume: '125.5', count: 45 }, ...]
```

**Response**:
```json
[
  {
    "currency": "ETH",
    "totalVolume": "125.50",
    "transactionCount": 45,
    "averageAmount": "2.79"
  },
  {
    "currency": "BTC",
    "totalVolume": "3.25",
    "transactionCount": 12,
    "averageAmount": "0.27"
  }
]
```

#### 4. GET `/api/v1/reports/fees`

**Purpose**: Get fee collection reports  
**Data Source**: `daily_metrics.fees_collected`  
**Query Parameters**: `startDate`, `endDate`

**Request Flow**:
```
1. Client → GET /api/v1/reports/fees
2. ReportsService.getFees(query)
   ├─> Queries daily_metrics.fees_collected
   ├─> Groups by date
   └─> Returns daily fee breakdown
3. Response: [{ date: '2025-12-01', fees: '15.25' }, ...]
```

#### 5. GET `/api/v1/reports/currencies`

**Purpose**: Get currency breakdown across all metrics  
**Data Source**: `daily_metrics.volume_by_currency`  
**Query Parameters**: `startDate`, `endDate`

**Request Flow**:
```
1. Client → GET /api/v1/reports/currencies
2. ReportsService.getCurrencies(query)
   ├─> Queries daily_metrics
   ├─> Extracts volume_by_currency JSON
   ├─> Aggregates across all currencies
   └─> Returns comprehensive currency stats
3. Response: [{ currency: 'ETH', deposits: '100', withdrawals: '25', ... }, ...]
```

---

### Reports - Users & Wallets (4)

#### 6. GET `/api/v1/reports/users/kyc-distribution`

**Purpose**: Get KYC status distribution  
**Data Source**: `audit_snapshots` WHERE `event_type = 'kyc'` (aggregated from `compliance.events`)  
**Query Parameters**: None

**Request Flow**:
```
1. Client → GET /api/v1/reports/users/kyc-distribution
2. ReportsService.getKycDistribution()
   ├─> Queries audit_snapshots WHERE event_type LIKE '%kyc%'
   ├─> Groups by metadata.status (PENDING, APPROVED, REJECTED)
   └─> Returns status distribution
3. Response: [{ status: 'APPROVED', count: 150 }, ...]
```

**Response**:
```json
[
  {
    "status": "APPROVED",
    "count": 150,
    "percentage": 75.0
  },
  {
    "status": "PENDING",
    "count": 30,
    "percentage": 15.0
  },
  {
    "status": "REJECTED",
    "count": 20,
    "percentage": 10.0
  }
]
```

#### 7. GET `/api/v1/reports/users/active`

**Purpose**: Get active user metrics  
**Data Source**: `audit_snapshots` (users with recent activity)  
**Query Parameters**: `startDate`, `endDate`

**Request Flow**:
```
1. Client → GET /api/v1/reports/users/active
2. ReportsService.getActiveUsers(query)
   ├─> Queries audit_snapshots WHERE created_at BETWEEN dates
   ├─> Groups by user_id, counts distinct users per day
   └─> Returns daily active user counts
3. Response: [{ date: '2025-12-01', activeUsers: 45 }, ...]
```

#### 8. GET `/api/v1/reports/wallets/deposits`

**Purpose**: Get deposit analytics  
**Data Source**: `audit_snapshots` WHERE `event_type = 'deposit'`  
**Query Parameters**: `currency` (optional)

**Request Flow**:
```
1. Client → GET /api/v1/reports/wallets/deposits?currency=ETH
2. ReportsService.getWalletDeposits(query)
   ├─> Queries audit_snapshots WHERE event_type = 'deposit'
   ├─> Filters by currency if provided
   ├─> Aggregates: SUM(amount), COUNT(*), AVG(amount)
   └─> Returns deposit statistics
3. Response: [{ currency: 'ETH', totalAmount: '125.5', count: 45 }, ...]
```

#### 9. GET `/api/v1/reports/wallets/withdrawals`

**Purpose**: Get withdrawal analytics  
**Data Source**: `audit_snapshots` WHERE `event_type = 'withdrawal'`  
**Query Parameters**: `currency` (optional)

**Request Flow**: Same as deposits, but filters for `event_type = 'withdrawal'`

---

### System Metrics (5)

#### 10. GET `/api/v1/metrics/listeners`

**Purpose**: Get blockchain listener health metrics  
**Data Source**: `system_metrics` WHERE `metric_type = 'listener_lag'`  
**Query Parameters**: `serviceName`, `chain`

**Request Flow**:
```
1. Client → GET /api/v1/metrics/listeners?chain=ETHEREUM
2. MetricsService.getListenerMetrics(query)
   ├─> Queries system_metrics WHERE metric_type = 'listener_lag'
   ├─> Filters by chain if provided
   └─> Returns listener lag data
3. Response: [{ serviceName: 'wallet-listener', chain: 'ETHEREUM', blockLag: 5 }, ...]
```

**Response**:
```json
[
  {
    "serviceName": "wallet-listener",
    "chain": "ETHEREUM",
    "lastProcessedBlock": 19500000,
    "latestChainBlock": 19500005,
    "blockLag": 5,
    "status": "healthy",
    "lastUpdated": "2025-12-30T10:00:00Z"
  }
]
```

#### 11. GET `/api/v1/metrics/events`

**Purpose**: Get Kafka event processing statistics  
**Data Source**: `system_metrics` WHERE `metric_type = 'kafka_events'`

**Request Flow**:
```
1. Client → GET /api/v1/metrics/events
2. MetricsService.getEventMetrics()
   ├─> Queries system_metrics WHERE metric_type = 'kafka_events'
   ├─> Groups by topic
   └─> Returns event processing stats
3. Response: [{ topic: 'wallet.events', totalProcessed: 1500, ... }, ...]
```

#### 12. GET `/api/v1/metrics/errors`

**Purpose**: Get error rate metrics  
**Data Source**: `system_metrics` WHERE `metric_type LIKE 'error_%'`  
**Query Parameters**: `serviceName`

**Request Flow**:
```
1. Client → GET /api/v1/metrics/errors
2. MetricsService.getErrorMetrics(query)
   ├─> Queries system_metrics WHERE metric_type LIKE 'error_%'
   ├─> Aggregates error counts by type
   └─> Returns error statistics
3. Response: [{ serviceName: 'wallet-service', errorType: 'timeout', count: 5 }, ...]
```

#### 13. GET `/api/v1/metrics/hot-wallets`

**Purpose**: Get hot wallet balance metrics  
**Data Source**: `system_metrics` WHERE `metric_type = 'wallet_balance'`  
**Query Parameters**: `chain`

**Request Flow**:
```
1. Client → GET /api/v1/metrics/hot-wallets?chain=ETHEREUM
2. MetricsService.getHotWalletMetrics(query)
   ├─> Queries system_metrics WHERE metric_type = 'wallet_balance'
   ├─> Filters by chain
   └─> Returns wallet balance data
3. Response: [{ chain: 'ETHEREUM', balance: '500.5', status: 'healthy' }, ...]
```

#### 14. GET `/api/v1/metrics/audit`

**Purpose**: Get audit log metrics  
**Data Source**: `audit_snapshots` (aggregated by event type)

**Request Flow**:
```
1. Client → GET /api/v1/metrics/audit
2. MetricsService.getAuditMetrics()
   ├─> Queries audit_snapshots
   ├─> Groups by event_type
   ├─> Counts events in last 24h, last hour
   └─> Returns audit activity stats
3. Response: [{ eventType: 'deposit', totalCount: 500, last24hCount: 45 }, ...]
```

---

### Alerts (5)

#### 15. GET `/api/v1/alerts`

**Purpose**: Get active alerts  
**Data Source**: `alerts` table  
**Query Parameters**: `status`, `severity`, `alertType`, `limit`

**Request Flow**:
```
1. Client → GET /api/v1/alerts?status=ACTIVE&severity=HIGH
2. AlertsService.getAlerts(query)
   ├─> Queries alerts WHERE status = 'ACTIVE' AND severity = 'HIGH'
   ├─> Orders by severity DESC, created_at DESC
   └─> Returns filtered alerts
3. Response: [{ id: 'alert_123', type: 'LISTENER_LAG', severity: 'HIGH', ... }, ...]
```

#### 16. POST `/api/v1/alerts/acknowledge/:alertId`

**Purpose**: Acknowledge an alert  
**Data Source**: `alerts` table (mutation)  
**Request Body**: `{ note: 'Investigating...' }`

**Request Flow**:
```
1. Client → POST /api/v1/alerts/acknowledge/alert_123 { note: '...' }
2. AlertsService.acknowledgeAlert(alertId, dto)
   ├─> Queries alerts WHERE id = alertId
   ├─> Updates status = 'ACKNOWLEDGED'
   ├─> Adds note to metadata
   └─> Returns updated alert
3. Response: { success: true, alertId: 'alert_123', newStatus: 'ACKNOWLEDGED' }
```

#### 17. GET `/api/v1/alerts/history`

**Purpose**: Get alert history  
**Data Source**: `alerts` table (all statuses)  
**Query Parameters**: `severity`, `alertType`, `limit`

**Request Flow**: Same as GET /alerts, but includes all statuses (ACTIVE, ACKNOWLEDGED, RESOLVED)

#### 18. GET `/api/v1/alerts/rules`

**Purpose**: Get alert rules  
**Data Source**: `alert_rules` table

**Request Flow**:
```
1. Client → GET /api/v1/alerts/rules
2. AlertsService.getAlertRules()
   ├─> Queries alert_rules WHERE is_active = true
   └─> Returns all active rules
3. Response: [{ id: 'rule_1', ruleType: 'LISTENER_LAG', threshold: 100, ... }, ...]
```

#### 19. POST `/api/v1/alerts/rules`

**Purpose**: Create a new alert rule  
**Data Source**: `alert_rules` table (mutation)  
**Request Body**:
```json
{
  "ruleType": "HIGH_LATENCY",
  "conditionExpression": "latency > 500",
  "threshold": 500,
  "severity": "HIGH",
  "action": "slack",
  "isActive": true
}
```

**Request Flow**:
```
1. Client → POST /api/v1/alerts/rules { ...payload... }
2. AlertsService.createAlertRule(dto)
   ├─> Validates payload
   ├─> Inserts into alert_rules table
   └─> Returns created rule
3. Response: { id: 'rule_1', ruleType: 'HIGH_LATENCY', ... }
```

#### 20. PUT `/api/v1/alerts/rules/:ruleId`

**Purpose**: Update alert rule  
**Data Source**: `alert_rules` table (mutation)  
**Request Body**: `{ threshold: 150, severity: 'CRITICAL' }`

**Request Flow**:
```
1. Client → PUT /api/v1/alerts/rules/rule_1 { threshold: 150 }
2. AlertsService.updateAlertRule(ruleId, dto)
   ├─> Queries alert_rules WHERE id = ruleId
   ├─> Updates threshold, severity, etc.
   └─> Returns updated rule
3. Response: { id: 'rule_1', threshold: 150, ... }
```

---

### Exports (2)

#### 20. GET `/api/v1/exports/daily`

**Purpose**: Get daily export data  
**Data Source**: `daily_metrics` table  
**Query Parameters**: `date` (YYYY-MM-DD)

**Request Flow**:
```
1. Client → GET /api/v1/exports/daily?date=2025-12-30
2. ExportsService.getDailyExport(query)
   ├─> Queries daily_metrics WHERE date = '2025-12-30'
   └─> Returns full daily metrics record
3. Response: { date: '2025-12-30', totalDeposits: '500.5', ... }
```

#### 21. GET `/api/v1/exports/manual`

**Purpose**: Trigger manual export to S3/data lake  
**Data Source**: `daily_metrics` (exported to S3)  
**Query Parameters**: `date`

**Request Flow**:
```
1. Client → GET /api/v1/exports/manual?date=2025-12-30
2. ExportsService.triggerManualExport(query)
   ├─> Queries daily_metrics WHERE date = '2025-12-30'
   ├─> Exports to S3 bucket (s3://exports/2025-12-30/...)
   └─> Returns export URL
3. Response: { success: true, exportUrl: 's3://...', timestamp: '...' }
```

---

## Data Flow Examples

### Example 1: Escrow Summary Report

```
┌─────────────────────────────────────────────────────────────────────┐
│ How does GET /api/v1/reports/escrows/summary work?                 │
└─────────────────────────────────────────────────────────────────────┘

1. Data Originates in Escrow Service
   └─> Escrow Service creates/completes/disputes escrows
       └─> Publishes events to `escrow.events` topic

2. Reporting Service Consumes Events
   └─> ReportingConsumer receives `escrow.created` event
       └─> Routes to EscrowEventHandler
           └─> Calls AggregationService.recordEscrowCreated()
               └─> Updates daily_metrics.escrow_created += 1

3. Client Requests Report
   └─> GET /api/v1/reports/escrows/summary?startDate=2025-12-01
       └─> ReportsController.getEscrowSummary(query)
           └─> ReportsService.getEscrowSummary(query)
               └─> Queries daily_metrics:
                   SELECT 
                     SUM(escrow_created) as totalCreated,
                     SUM(escrow_completed) as totalCompleted,
                     SUM(escrow_disputed) as totalDisputed
                   FROM daily_metrics
                   WHERE date BETWEEN '2025-12-01' AND '2025-12-31'

4. Response Returned
   └─> { totalCreated: 150, totalCompleted: 120, totalDisputed: 5 }

Key Points:
- Data Source: daily_metrics (NOT escrow service database)
- Data Population: Kafka events → AggregationService → daily_metrics
- Query Performance: Fast (pre-aggregated data)
- Data Freshness: Near real-time (depends on Kafka lag)
```

### Example 2: KYC Distribution Report

```
┌─────────────────────────────────────────────────────────────────────┐
│ How does GET /api/v1/reports/users/kyc-distribution work?          │
└─────────────────────────────────────────────────────────────────────┘

1. Data Originates in Compliance Service
   └─> Compliance Service updates KYC status
       └─> Publishes `compliance.kyc.updated` to `compliance.events`

2. Reporting Service Consumes Events
   └─> ReportingConsumer receives event
       └─> Routes to KycVerificationHandler
           └─> Calls AggregationService.createAuditSnapshot({
                 eventType: 'kyc',
                 referenceId: userId,
                 metadata: { status: 'APPROVED', ... }
               })
               └─> Inserts into audit_snapshots table

3. Client Requests Report
   └─> GET /api/v1/reports/users/kyc-distribution
       └─> ReportsController.getKycDistribution()
           └─> ReportsService.getKycDistribution()
               └─> Queries audit_snapshots:
                   SELECT 
                     metadata->>'status' as status,
                     COUNT(*) as count
                   FROM audit_snapshots
                   WHERE event_type = 'kyc'
                   GROUP BY metadata->>'status'

4. Response Returned
   └─> [
         { status: 'APPROVED', count: 150, percentage: 75.0 },
         { status: 'PENDING', count: 30, percentage: 15.0 }
       ]

Key Points:
- Data Source: audit_snapshots (event-level data)
- Data Population: compliance.events → KycVerificationHandler → audit_snapshots
- Query Pattern: JSON aggregation (metadata->>'status')
- Historical Data: All KYC events preserved for compliance
```

### Example 3: Listener Health Metrics

```
┌─────────────────────────────────────────────────────────────────────┐
│ How does GET /api/v1/metrics/listeners work?                       │
└─────────────────────────────────────────────────────────────────────┘

1. Data Originates in Wallet Listener Service
   └─> Wallet Listener monitors blockchain
       └─> Periodically reports health to Reporting Service
           └─> Direct API call or Kafka event to update system_metrics

2. Reporting Service Stores Metrics
   └─> AggregationService.updateSystemMetric({
         serviceName: 'wallet-listener',
         metricType: 'listener_lag',
         metricValue: 5,
         chain: 'ETHEREUM'
       })
       └─> Upserts into system_metrics table

3. Client Requests Metrics
   └─> GET /api/v1/metrics/listeners?chain=ETHEREUM
       └─> MetricsController.getListenerMetrics(query)
           └─> MetricsService.getListenerMetrics(query)
               └─> Queries system_metrics:
                   SELECT *
                   FROM system_metrics
                   WHERE metric_type = 'listener_lag'
                     AND chain = 'ETHEREUM'
                   ORDER BY updated_at DESC

4. Response Returned
   └─> [
         {
           serviceName: 'wallet-listener',
           chain: 'ETHEREUM',
           blockLag: 5,
           status: 'healthy',
           lastUpdated: '2025-12-30T10:00:00Z'
         }
       ]

Key Points:
- Data Source: system_metrics (infrastructure health)
- Data Population: External monitoring services → system_metrics
- Update Frequency: Real-time (every few seconds)
- Use Case: Operational monitoring, alerting
```

---

## Environment Variables

```env
# ====================================
# APPLICATION
# ====================================
PORT=3007
SERVICE_NAME=reporting-service
NODE_ENV=development

# ====================================
# DATABASE
# ====================================
DATABASE_URL=postgresql://user:pass@localhost:5432/escrowly?schema=reporting_db

# ====================================
# S2S AUTHENTICATION
# ====================================
SERVICE_API_KEY=your-secure-service-api-key-here

# ====================================
# JWT AUTHENTICATION (for reference)
# ====================================
JWT_SECRET=your-jwt-secret-here
JWT_ISSUER=escrowly-auth
JWT_AUDIENCE=escrowly

# ====================================
# KAFKA
# ====================================
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=reporting-service
KAFKA_GROUP_ID=reporting-service-group

# ====================================
# MONITORING & HEALTH CHECKS
# ====================================
HEALTH_CHECK_TIMEOUT_MS=5000
HOT_WALLET_BALANCE_THRESHOLD=5000
ADMIN_SERVICE_URL=http://localhost:3001

# ====================================
# AWS (for Secrets Manager)
# ====================================
AWS_REGION=us-east-1
AWS_SECRETS_MANAGER_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:escrowly-reporting

# ====================================
# MONITORING (Optional)
# ====================================
SENTRY_DSN=https://...
LOG_LEVEL=debug
```

### Critical Configuration Notes

1. **SERVICE_API_KEY**: MUST match across all services for S2S authentication
2. **JWT_SECRET**: MUST match the Auth Service's JWT_SECRET (for reference only, not used with S2S)
3. **DATABASE_URL**: Uses `schema=reporting_db` to isolate from other services
4. **KAFKA_ENABLED**: Set to `false` for local development without Kafka
5. **KAFKA_GROUP_ID**: Must be unique per service to ensure all events are consumed
6. **HOT_WALLET_BALANCE_THRESHOLD**: Adjust based on business requirements
7. **ADMIN_SERVICE_URL**: URL of admin service for S2S hot wallet balance checks

---

## Testing

### API Testing

```bash
# Run API test script
node scripts/test-reporting-apis.js

# Test specific endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:3007/api/v1/reports/escrows/summary
```

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run specific test file
npm run test -- reports.service.spec.ts

# Run with coverage
npm run test:cov
```

### E2E Tests

```bash
# Run end-to-end tests
npm run test:e2e

# Run specific e2e test
npm run test:e2e -- reports.e2e-spec.ts
```

### Manual Testing with Postman

1. **Get JWT Token** from Auth Service:
   ```bash
   POST http://localhost:3000/api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

2. **Use Token** in Reporting Service:
   ```bash
   GET http://localhost:3007/api/v1/reports/escrows/summary
   Headers:
     Authorization: Bearer <access_token>
   ```

3. **Common Test Scenarios**:
   - Escrow summary with date range
   - Transaction volume by currency
   - KYC distribution
   - Listener health metrics
   - Alert management

### Verification Scripts

The service includes dedicated scripts to verify critical flows:

#### 1. Event Persistence Verification
Verifies that Kafka events are correctly persisted to `daily_metrics`, `audit_snapshots`, and `system_metrics`.

```bash
node scripts/test-event-persistence.js
```

**What it tests:**
*   **Wallet Deposits**: Ensures `WalletDeposited` events update daily metrics and create audit logs.
*   **Admin Actions**: Ensures `AdminAction` events create audit snapshots.
*   **System Metrics**: Checks for correct system metric updates.

#### 2. Alert Rules Persistence Verification
Verifies that the Alert Rules API correctly persists rules to the database.

```bash
node scripts/test-alert-rules.js
```

**What it tests:**
*   API Authentication (JWT)
*   `POST /api/v1/alerts/rules`
*   Database entry creation

#### 3. Kafka Failure Verification
Verifies that failed consumer events are captured in the Dead Letter Queue (DLQ).

```bash
node scripts/test-kafka-failures.js
```

**What it tests:**
*   Produces malformed/failed events to failure topics
*   Verifies entry in `kafka_failures` table

---

## Alert Rules

The Reporting Service monitors system health and triggers alerts based on configurable rules:

| Rule Type | Condition | Severity | Action | Description |
|-----------|-----------|----------|--------|-------------|
| `LISTENER_LAG` | `block_lag > 100` | HIGH | Slack + Email | Blockchain listener is falling behind |
| `ESCROW_STUCK` | `state_duration > 48h` | CRITICAL | Alert + Auto-reminder | Escrow stuck in pending state |
| `FAILED_WITHDRAWALS` | `failure_rate > 5% in 24h` | MEDIUM | Finance alert | High withdrawal failure rate |
| `LOW_HOT_WALLET_BALANCE` | `balance < 10%` | CRITICAL | Stop payouts | Hot wallet balance critically low |
| `LEDGER_MISMATCH` | Ledger inconsistency | HIGH | Immediate alert | Ledger balance mismatch detected |

### Alert Workflow

```
1. System Metric Updated
   └─> AggregationService.updateSystemMetric({ metricType: 'listener_lag', metricValue: 150 })

2. Alert Rule Evaluation (background job)
   └─> Check if metricValue > threshold
       └─> If true, create alert

3. Alert Created
   └─> AlertsService.createAlert({
         alertType: 'LISTENER_LAG',
         severity: 'HIGH',
         description: 'Listener lag is 150 blocks (threshold: 100)'
       })
       └─> Publishes `alert.triggered` event to Kafka

4. Notification Service Consumes Event
   └─> Sends Slack/Email notification

5. Admin Acknowledges Alert
   └─> POST /api/v1/alerts/acknowledge/:alertId
       └─> Updates alert status to 'ACKNOWLEDGED'
```

---

## License

Private - Escrowly Platform

---

## Additional Resources

- **Swagger Documentation**: http://localhost:3007/api/docs
- **Prisma Studio**: `npx prisma studio` (database GUI)
- **Kafka UI**: http://localhost:8080 (if using Redpanda Console)

---

## FAQ

### Q: Why can't I query user data directly?
**A**: The Reporting Service does NOT have access to the Auth Service database. It only has access to `reporting_db`, which is populated by Kafka events. To get user data, query the Auth Service API directly.

### Q: Why is my report data stale?
**A**: Report data is populated by Kafka events. Check:
1. Is `KAFKA_ENABLED=true`?
2. Are Kafka consumers running? (Check logs for "Reporting consumer subscribed")
3. Is there Kafka lag? (Check `/api/v1/metrics/events`)

### Q: How do I add a new report?
**A**: 
1. Ensure the data is being captured in `daily_metrics` or `audit_snapshots` via Kafka handlers
2. Add a new method to `ReportsService`
3. Add a new endpoint to `ReportsController`
4. Add a DTO for the response shape

### Q: Can I query the Escrow Service database directly?
**A**: No. The Reporting Service is isolated and only queries `reporting_db`. This ensures:
- No performance impact on source services
- Clear separation of concerns
- Scalability (reporting DB can be optimized separately)

### Q: How do I debug Kafka event consumption?
**A**: 
1. Check logs for `[DEBUG] Subscribing to Wallet Topic: wallet.events`
2. Enable debug logging: `LOG_LEVEL=debug`
3. Check Kafka consumer group lag: `kafka-consumer-groups --describe --group reporting-service-group`
4. Verify event schema with `EventValidatorService` logs

---

**End of README**