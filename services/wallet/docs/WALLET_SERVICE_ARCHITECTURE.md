# Wallet Service - Complete Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Entry Points](#entry-points)
4. [Module Structure](#module-structure)
5. [Core Flows](#core-flows)
   - [User Wallet Creation Flow](#1-user-wallet-creation-flow)
   - [Deposit Detection Flow](#2-deposit-detection-flow)
   - [Withdrawal Execution Flow](#3-withdrawal-execution-flow)
   - [Deposit Sweep Flow](#4-deposit-sweep-flow)
   - [Withdrawal Retry Flow](#5-withdrawal-retry-flow)
6. [Database Schema](#database-schema)
7. [Kafka Events](#kafka-events)
8. [Configuration](#configuration)
9. [Chain Support](#chain-support)
10. [Security](#security)
11. [File Reference](#file-reference)

---

## Overview

The **Wallet Service** is the blockchain execution engine for Escrowly. It handles:

- **Custodial Wallet Management**: Generates and manages user deposit wallets across multiple blockchains
- **Deposit Processing**: Detects and processes incoming token deposits from the listener-engine
- **Withdrawal Execution**: Executes on-chain withdrawals to external addresses
- **Deposit Sweeping**: Periodically moves funds from user wallets to the hot wallet
- **Retry Mechanisms**: Automatically retries failed withdrawals

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Port** | 3004 (default) |
| **Database Schema** | `wallet_db` |
| **Supported Chains** | EVM (ETH/BSC/Polygon), Solana, Tron |
| **Supported Tokens** | USDT, USDC, DAI |
| **Event Bus** | Kafka (producer + consumer) |
| **Queue** | Redis (BLPOP consumer from listener-engine) |

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WALLET SERVICE                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐          │
│  │   Kafka Topics   │    │   Redis Queues   │    │   HTTP API       │          │
│  │   (Events In)    │    │   (Events In)    │    │   (Queries)      │          │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘          │
│           │                       │                       │                     │
│           ▼                       ▼                       ▼                     │
│  ┌──────────────────────────────────────────────────────────────────┐          │
│  │                         CONSUMERS MODULE                          │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │          │
│  │  │ UserCreated     │  │ Withdrawal      │  │ Deposit         │   │          │
│  │  │ Consumer        │  │ Requested       │  │ Processor       │   │          │
│  │  │ (Kafka)         │  │ Consumer        │  │ (Redis BLPOP)   │   │          │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘   │          │
│  └───────────┼────────────────────┼────────────────────┼────────────┘          │
│              │                    │                    │                        │
│              ▼                    ▼                    ▼                        │
│  ┌──────────────────────────────────────────────────────────────────┐          │
│  │                          CRYPTO MODULE                            │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │          │
│  │  │ Wallet          │  │ Encryption      │  │ Chain           │   │          │
│  │  │ Generator       │  │ Service         │  │ Executors       │   │          │
│  │  │                 │  │ (AES-256-GCM)   │  │ (EVM/SOL/TRC)   │   │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘   │          │
│  └──────────────────────────────────────────────────────────────────┘          │
│              │                    │                    │                        │
│              ▼                    ▼                    ▼                        │
│  ┌──────────────────────────────────────────────────────────────────┐          │
│  │                        DATA LAYER                                 │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │          │
│  │  │ Prisma          │  │ Redis           │  │ Kafka           │   │          │
│  │  │ (PostgreSQL)    │  │ (Queue)         │  │ (Events Out)    │   │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘   │          │
│  └──────────────────────────────────────────────────────────────────┘          │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐          │
│  │                          CRON MODULE                              │          │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐        │          │
│  │  │ Withdrawal Retry        │  │ Deposit Sweep           │        │          │
│  │  │ (Every 30 seconds)      │  │ (Every 5 minutes)       │        │          │
│  │  └─────────────────────────┘  └─────────────────────────┘        │          │
│  └──────────────────────────────────────────────────────────────────┘          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points

### 1. Main Entry Point

**File**: `src/main.ts`

```typescript
// Bootstrap the application
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ... configuration
  await app.listen(port); // Default: 3004
}
```

**Responsibilities**:
- Creates NestJS application
- Configures CORS, validation pipes, API versioning
- Sets up Swagger documentation (`/api/docs`)
- Enables graceful shutdown hooks

### 2. Root Module

**File**: `src/app.module.ts`

**Module Import Order** (important for dependency injection):
1. `ConfigModule` - Environment variables
2. `ScheduleModule` - Cron job scheduling
3. `SecretsModule` - AWS Secrets Manager / local secrets
4. `PrismaModule` - Database connection
5. `RedisModule` - Redis connection
6. `HealthModule` - Health check endpoints
7. `ConfigurationModule` - Chain/wallet configuration
8. `CryptoModule` - Wallet generation & executors
9. `KafkaIntegrationModule` - Kafka producer/consumer
10. `ConsumersModule` - Event consumers
11. `CronModule` - Scheduled jobs
12. `PayoutsModule` - Payout query API

---

## Module Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── app.controller.ts          # Basic app info endpoint
├── app.service.ts             # App service
│
├── config/                    # Configuration
│   ├── chain.config.ts        # Chain definitions (tokens, RPC keys)
│   ├── wallet.config.ts       # Runtime config service
│   └── config.module.ts       # Config module
│
├── consumers/                 # Event Consumers
│   ├── user-created.consumer.ts       # Kafka: auth.user.created
│   ├── withdrawal-requested.consumer.ts # Kafka: ledger.external_payout_created
│   ├── deposit-processor.service.ts   # Redis: raw_events_* queues
│   └── consumers.module.ts
│
├── cron/                      # Scheduled Jobs
│   ├── withdrawal-retry.cron.ts  # Retry failed withdrawals
│   ├── deposit-sweep.cron.ts     # Sweep deposits to hot wallet
│   └── cron.module.ts
│
├── crypto/                    # Cryptographic Operations
│   ├── encryption.service.ts     # AES-256-GCM encryption
│   ├── wallet-generator.service.ts # Generate wallets (EVM/SOL/TRC)
│   ├── evm-executor.service.ts   # EVM transaction execution
│   ├── solana-executor.service.ts # Solana transaction execution
│   ├── tron-executor.service.ts  # Tron transaction execution
│   └── crypto.module.ts
│
├── kafka/                     # Kafka Integration
│   ├── wallet-event-producer.ts  # Produce wallet events
│   ├── outbox.repository.ts      # Outbox pattern storage
│   ├── prisma-outbox.adapter.ts  # Outbox adapter for publisher
│   └── kafka-integration.module.ts
│
├── payouts/                   # Payout Query API
│   ├── payouts.controller.ts     # REST endpoints
│   ├── payouts.service.ts        # Query logic
│   ├── dto/                      # Response DTOs
│   └── payouts.module.ts
│
├── prisma/                    # Database
│   ├── prisma.service.ts         # Prisma client
│   └── prisma.module.ts
│
├── redis/                     # Redis
│   ├── redis.service.ts          # Redis client (BLPOP)
│   └── redis.module.ts
│
└── health/                    # Health Checks
    ├── health.controller.ts
    ├── health.service.ts
    └── health.module.ts
```

---

## Core Flows

### 1. User Wallet Creation Flow

**Trigger**: Kafka event `auth.user.created`

**Consumer**: `UserCreatedConsumer` (`src/consumers/user-created.consumer.ts`)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Auth Service   │────▶│  Kafka Topic    │────▶│  UserCreated    │
│  (user signup)  │     │ auth.user.created│     │  Consumer       │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Check Idempotency│
                                               │ (processed_events)│
                                               └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Generate 3 Wallets│
                                               │ EVM, SOL, TRC    │
                                               └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Encrypt Private │
                                               │ Keys (AES-256)  │
                                               └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Store in DB     │
                                               │ (user_wallets)  │
                                               └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Emit Kafka Event │
                                               │ wallet.wallet.created│
                                               └─────────────────┘
```

**Detailed Steps**:

1. **Receive Event**: Consumer subscribes to `auth.user.created` on module init
2. **Idempotency Check**: Query `processed_events` table by `eventId`
3. **Duplicate Check**: Query `user_wallets` by `userId` to prevent duplicates
4. **Generate Wallets**: Call `WalletGeneratorService.generateAllWallets()`
   - EVM: `ethers.Wallet.createRandom()`
   - Solana: `Keypair.generate()`
   - Tron: `tronWeb.createAccount()`
5. **Encrypt Keys**: Each private key encrypted with AES-256-GCM
6. **Database Transaction**:
   - Insert 3 wallets into `user_wallets`
   - Insert record into `processed_events`
7. **Emit Event**: Produce `wallet.wallet.created` to Kafka

---

### 2. Deposit Detection Flow

**Trigger**: Redis queue events from `listener-engine`

**Consumer**: `DepositProcessorService` (`src/consumers/deposit-processor.service.ts`)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Listener Engine │────▶│  Redis Queue    │────▶│ DepositProcessor│
│ (blockchain)    │     │ raw_events_*    │     │ (BLPOP loop)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Lookup User by  │
                                               │ depositAddress  │
                                               └────────┬────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          │                             │
                                          ▼                             ▼
                                   ┌──────────────┐             ┌──────────────┐
                                   │ Not Our User │             │ Our User     │
                                   │ (skip)       │             │ (process)    │
                                   └──────────────┘             └──────┬───────┘
                                                                       │
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │ Check Duplicate │
                                                              │ (txHash)        │
                                                              └────────┬────────┘
                                                                       │
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │ Create Deposit  │
                                                              │ Record          │
                                                              └────────┬────────┘
                                                                       │
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │ Emit Kafka Event│
                                                              │ wallet.deposit.detected│
                                                              └─────────────────┘
```

**Detailed Steps**:

1. **BLPOP Loop**: Continuously blocks on Redis queues:
   - `raw_events_eth`
   - `raw_events_bnb`
   - `raw_events_poly`
   - `raw_events_sol`
   - `raw_events_trc`
2. **Map Chain**: Convert listener chain (eth/bnb/poly) to wallet chain (evm)
3. **Lookup User**: Query `user_wallets` by `depositAddress` (case-insensitive)
4. **Skip Non-Users**: If address not found, skip (not our user's wallet)
5. **Idempotency**: Check `deposit_transactions` by `chain + txHash`
6. **Create Record**: Insert into `deposit_transactions` with status `pending`
7. **Emit Event**: Produce `wallet.deposit.detected` to Kafka

**RawTransferEvent Structure** (from Redis):
```typescript
interface RawTransferEvent {
  chain: string;        // eth, bnb, poly, sol, trc
  blockNumber: number;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;           // This is the deposit address
  amount: string;
  tokenSymbol: string;  // USDT, USDC, DAI
  tokenAddress: string;
  timestamp: number;
}
```

---

### 3. Withdrawal Execution Flow

**Trigger**: Kafka event `ledger.external_payout_created`

**Consumer**: `WithdrawalRequestedConsumer` (`src/consumers/withdrawal-requested.consumer.ts`)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Ledger Service  │────▶│  Kafka Topic    │────▶│ Withdrawal      │
│ (payout request)│     │ledger.external_ │     │ Consumer        │
└─────────────────┘     │payout_created   │     └────────┬────────┘
                        └─────────────────┘              │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Check Idempotency│
                                               │ (eventId)        │
                                               └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Create Payout   │
                                               │ Request (pending)│
                                               └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Execute On-Chain│
                                               │ Transaction     │
                                               └────────┬────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          │                             │
                                          ▼                             ▼
                                   ┌──────────────┐             ┌──────────────┐
                                   │ Success      │             │ Failure      │
                                   └──────┬───────┘             └──────┬───────┘
                                          │                             │
                                          ▼                             ▼
                                   ┌──────────────┐             ┌──────────────┐
                                   │ Update Status│             │ Create Attempt│
                                   │ = fulfilled  │             │ Record        │
                                   └──────┬───────┘             └──────┬───────┘
                                          │                             │
                                          ▼                             ▼
                                   ┌──────────────┐             ┌──────────────┐
                                   │ Emit         │             │ Emit         │
                                   │ withdrawal.  │             │ withdrawal.  │
                                   │ completed    │             │ failed       │
                                   └──────────────┘             └──────────────┘
```

**Detailed Steps**:

1. **Receive Event**: Consumer subscribes to `ledger.external_payout_created`
2. **Idempotency**: Check `payout_requests` by `eventId`
3. **Create Request**: Insert into `payout_requests` with status `pending`
4. **Route by Chain**: Determine executor based on chain type
5. **Execute Transaction**:
   - **EVM**: `EvmExecutorService.executeWithdrawal()`
   - **Solana**: `SolanaExecutorService.executeWithdrawal()`
   - **Tron**: `TronExecutorService.executeWithdrawal()`
6. **Handle Result**:
   - **Success**: Update status to `fulfilled`, store `txHash`, emit success event
   - **Failure**: Create `payout_attempt` record, emit failure event (will be retried)

---

### 4. Deposit Sweep Flow

**Trigger**: Cron job every 5 minutes

**Service**: `DepositSweepCron` (`src/cron/deposit-sweep.cron.ts`)

```
┌─────────────────┐
│ Cron Trigger    │
│ (Every 5 min)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Query All       │
│ User Wallets    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ For Each Wallet │
│ Check Balances  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Balance > 0?    │
└────────┬────────┘
         │
    Yes  │
         ▼
┌─────────────────┐
│ Needs Gas       │
│ Funding?        │
└────────┬────────┘
         │
    Yes  │
         ▼
┌─────────────────┐
│ Fund from       │
│ Funding Wallet  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execute Token   │
│ Transfer to     │
│ Hot Wallet      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Emit            │
│ sweep.completed │
└─────────────────┘
```

**Purpose**: Consolidate user deposits into the hot wallet for:
- Easier liquidity management
- Reduced on-chain complexity for withdrawals
- Security (fewer keys with significant balances)

**Process per Chain**:
1. Query all `user_wallets` for the chain (batch of 50)
2. For each wallet, check token balances (USDT, USDC, DAI)
3. If balance > 0:
   - Check if wallet has enough gas/rent
   - If not, fund from funding wallet
   - Wait for funding confirmation
   - Transfer tokens to hot wallet
4. Emit `wallet.sweep.completed` event

---

### 5. Withdrawal Retry Flow

**Trigger**: Cron job every 30 seconds

**Service**: `WithdrawalRetryCron` (`src/cron/withdrawal-retry.cron.ts`)

```
┌─────────────────┐
│ Cron Trigger    │
│ (Every 30 sec)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Query Pending   │
│ Payout Requests │
│ (limit 10)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ For Each Payout │
│ Count Attempts  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Attempts >= 5?  │
└────────┬────────┘
         │
    Yes  │──────────────────┐
         │                  │
    No   │                  ▼
         │         ┌─────────────────┐
         │         │ Mark as Failed  │
         │         │ (permanent)     │
         │         └─────────────────┘
         ▼
┌─────────────────┐
│ Retry Execution │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Success     Failure
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│Update  │ │Create  │
│Status  │ │Attempt │
│fulfilled│ │Record  │
└────────┘ └────────┘
```

**Configuration**:
- **Max Retries**: 5 attempts
- **Batch Size**: 10 pending payouts per cycle
- **Schedule**: Every 30 seconds

---

## Database Schema

### Tables (in `wallet_db` schema)

#### 1. `user_wallets`
Stores custodial wallets for each user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Reference to auth user |
| `chain` | VARCHAR(10) | `evm`, `sol`, `trc` |
| `deposit_address` | TEXT | Public address |
| `encrypted_private_key` | TEXT | AES-256-GCM encrypted |
| `public_key` | TEXT | Public key (nullable) |

**Indexes**: `deposit_address`, `user_id`

#### 2. `deposit_transactions`
Tracks detected on-chain deposits.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner of deposit |
| `wallet_id` | UUID | Reference to user_wallets |
| `chain` | VARCHAR(10) | Source chain |
| `asset` | VARCHAR(10) | USDT, USDC, DAI |
| `amount` | DECIMAL(36,18) | Token amount |
| `tx_hash` | TEXT | Transaction hash |
| `block_number` | BIGINT | Block number |
| `status` | VARCHAR(20) | pending, confirmed, processed |

**Unique**: `chain + tx_hash`

#### 3. `payout_requests`
Tracks withdrawal executions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `event_id` | TEXT | Kafka event ID (idempotency) |
| `user_id` | UUID | Requester |
| `chain` | VARCHAR(10) | Target chain |
| `asset` | VARCHAR(10) | Token symbol |
| `amount` | DECIMAL(36,18) | Amount to send |
| `destination_address` | TEXT | External address |
| `status` | VARCHAR(20) | pending, fulfilled, failed |
| `tx_hash` | TEXT | On-chain tx hash |
| `gas_used` | DECIMAL(36,18) | Gas consumed |

#### 4. `payout_attempts`
Audit log for failed attempts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `payout_request_id` | UUID | Parent request |
| `attempt_number` | INT | 1, 2, 3... |
| `error_message` | TEXT | Failure reason |

#### 5. `processed_events`
Idempotency tracking for Kafka events.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `event_id` | TEXT | Kafka event ID |
| `event_type` | VARCHAR(100) | Topic name |

#### 6. `outbox_events`
Reliable Kafka publishing (outbox pattern).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `topic` | TEXT | Kafka topic |
| `partition_key` | TEXT | Partition key |
| `payload` | TEXT | JSON payload |
| `status` | VARCHAR(20) | pending, processing, published, failed |
| `retry_count` | INT | Retry attempts |
| `next_retry_at` | TIMESTAMP | Next retry time |

---

## Kafka Events

### Consumed Topics

| Topic | Source | Handler |
|-------|--------|---------|
| `auth.user.created` | Auth Service | `UserCreatedConsumer` |
| `ledger.external_payout_created` | Ledger Service | `WithdrawalRequestedConsumer` |

### Produced Topics

| Topic | Event | Trigger |
|-------|-------|---------|
| `wallet.wallet.created` | User wallets generated | New user signup |
| `wallet.deposit.detected` | Deposit found on-chain | Redis event processing |
| `wallet.deposit.confirmed` | Deposit confirmed | (Future: confirmation check) |
| `wallet.withdrawal.completed` | Withdrawal successful | On-chain tx confirmed |
| `wallet.withdrawal.failed` | Withdrawal failed | Execution error |
| `wallet.sweep.completed` | Sweep successful | Cron sweep job |

---

## Configuration

### Environment Variables

```bash
# Service
PORT=3004
SERVICE_NAME=wallet-service
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/escrowly?schema=wallet_db

# Redis
REDIS_URL=redis://:password@localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_ENABLED=true

# Encryption
ENCRYPTION_MODE=local  # or 'kms' for AWS KMS
WALLET_ENCRYPTION_KEY=your-32-byte-key-here

# EVM Configuration
ETH_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org
POLYGON_RPC_URL=https://polygon-rpc.com
EVM_HOT_WALLET=0x...
EVM_FUNDING_WALLET_KEY=encrypted_private_key
EVM_FUNDING_THRESHOLD=0.1
EVM_FUNDING_AMOUNT=0.5

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOL_HOT_WALLET=...base58...
SOL_FUNDING_WALLET_KEY=encrypted_private_key
SOL_FUNDING_THRESHOLD=0.1
SOL_FUNDING_AMOUNT=0.5

# Tron Configuration
TRON_RPC_URL=https://api.trongrid.io
TRC_HOT_WALLET=T...
TRC_FUNDING_WALLET_KEY=encrypted_private_key
TRC_FUNDING_THRESHOLD=10
TRC_FUNDING_AMOUNT=50

# Cron Schedules (optional)
WITHDRAWAL_RETRY_CRON=*/30 * * * * *
DEPOSIT_SWEEP_CRON=0 */5 * * * *
```

---

## Chain Support

### EVM Chains (Ethereum, BSC, Polygon)

**Library**: `ethers.js v6`

**Wallet Generation**:
```typescript
const wallet = ethers.Wallet.createRandom();
// Same wallet works across all EVM chains
```

**Token Transfers**: Standard ERC20 `transfer(address,uint256)`

**Supported Tokens**:
| Token | ETH Address | BSC Address | Polygon Address |
|-------|-------------|-------------|-----------------|
| USDT | 0xdAC17F958D2ee523a2206206994597C13D831ec7 | 0x55d398326f99059fF775485246999027B3197955 | 0xc2132D05D31c914a87C6611C10748AEb04B58e8F |
| USDC | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 | 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d | 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 |
| DAI | 0x6B175474E89094C44Da98b954EedeAC495271d0F | 0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3 | 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063 |

### Solana

**Library**: `@solana/web3.js`, `@solana/spl-token`

**Wallet Generation**:
```typescript
const keypair = Keypair.generate();
```

**Token Transfers**: SPL Token `createTransferInstruction`

**Supported Tokens**:
| Token | Mint Address |
|-------|--------------|
| USDT | Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB |
| USDC | EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v |

### Tron

**Library**: `tronweb`

**Wallet Generation**:
```typescript
const account = await tronWeb.createAccount();
```

**Token Transfers**: TRC20 `transfer(address,uint256)`

**Supported Tokens**:
| Token | Address |
|-------|---------|
| USDT | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USDC | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |

---

## Security

### Private Key Encryption

**Algorithm**: AES-256-GCM

**Process**:
1. Generate random 32-byte salt
2. Generate random 16-byte IV
3. Derive key from password using scrypt
4. Encrypt with AES-256-GCM
5. Store: `base64(salt + iv + authTag + ciphertext)`

**Modes**:
- `local`: Key from `WALLET_ENCRYPTION_KEY` env var
- `kms`: AWS KMS envelope encryption (planned)

### Hot Wallet Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      HOT WALLET                              │
│  (holds funds for withdrawals, receives swept deposits)     │
│                                                              │
│  EVM: EVM_HOT_WALLET                                        │
│  SOL: SOL_HOT_WALLET                                        │
│  TRC: TRC_HOT_WALLET                                        │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Sweep
                              │
┌─────────────────────────────────────────────────────────────┐
│                    USER DEPOSIT WALLETS                      │
│  (one per user per chain, encrypted keys in DB)             │
│                                                              │
│  User A: EVM wallet, SOL wallet, TRC wallet                 │
│  User B: EVM wallet, SOL wallet, TRC wallet                 │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Funding Wallet

Separate wallet used to fund user wallets with gas/rent:
- **EVM**: ETH/BNB/MATIC for gas
- **Solana**: SOL for rent
- **Tron**: TRX for energy/bandwidth

---

## File Reference

### Entry Points
| File | Purpose |
|------|---------|
| `src/main.ts` | Application bootstrap |
| `src/app.module.ts` | Root module, imports all modules |

### Configuration
| File | Purpose |
|------|---------|
| `src/config/chain.config.ts` | Chain definitions, token addresses |
| `src/config/wallet.config.ts` | Runtime config service |

### Consumers (Event Handlers)
| File | Trigger | Purpose |
|------|---------|---------|
| `src/consumers/user-created.consumer.ts` | Kafka: auth.user.created | Generate wallets |
| `src/consumers/withdrawal-requested.consumer.ts` | Kafka: ledger.external_payout_created | Execute withdrawals |
| `src/consumers/deposit-processor.service.ts` | Redis: raw_events_* | Process deposits |

### Crypto (Blockchain Operations)
| File | Purpose |
|------|---------|
| `src/crypto/encryption.service.ts` | AES-256-GCM encryption |
| `src/crypto/wallet-generator.service.ts` | Generate wallets for all chains |
| `src/crypto/evm-executor.service.ts` | EVM transaction execution |
| `src/crypto/solana-executor.service.ts` | Solana transaction execution |
| `src/crypto/tron-executor.service.ts` | Tron transaction execution |

### Cron Jobs
| File | Schedule | Purpose |
|------|----------|---------|
| `src/cron/withdrawal-retry.cron.ts` | Every 30 seconds | Retry failed withdrawals |
| `src/cron/deposit-sweep.cron.ts` | Every 5 minutes | Sweep deposits to hot wallet |

### Kafka
| File | Purpose |
|------|---------|
| `src/kafka/wallet-event-producer.ts` | Produce wallet events |
| `src/kafka/outbox.repository.ts` | Store failed events for retry |
| `src/kafka/prisma-outbox.adapter.ts` | Outbox pattern adapter |

### Database
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema definition |
| `src/prisma/prisma.service.ts` | Prisma client service |

---

## Quick Start

### Running Locally

```bash
# Install dependencies
cd services/wallet
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Start the service
npm run start:dev
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/health/ready` | Readiness check |
| GET | `/api/v1/payouts` | List payouts (requires auth) |
| GET | `/api/v1/payouts/:id` | Get payout by ID |

### Swagger Documentation

Available at: `http://localhost:3004/api/docs` (non-production only)

---

## Troubleshooting

### Common Issues

1. **Wallets not being created**
   - Check Kafka connection
   - Verify `auth.user.created` events are being produced
   - Check `processed_events` table for duplicates

2. **Deposits not detected**
   - Verify Redis connection
   - Check listener-engine is running and pushing to queues
   - Verify deposit address matches (case-insensitive)

3. **Withdrawals failing**
   - Check hot wallet balance
   - Verify RPC connection
   - Check `payout_attempts` for error messages

4. **Sweep not working**
   - Verify funding wallet has gas
   - Check user wallet balances
   - Review cron job logs

---

*Last Updated: December 2024*

