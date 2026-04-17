# Listener Engine Service

Blockchain transfer event listener service for the Escrowly platform.

## Overview

The Listener Engine listens to blockchain Transfer events for USDT, USDC, and DAI tokens across 5 chains and pushes raw events to Redis queues.

### Supported Chains

| Chain   | ID     | Queue Name       | Port (Docker) |
| ------- | ------ | ---------------- | ------------- |
| Ethereum | `eth`  | `raw_events_eth` | 3010          |
| BSC     | `bnb`  | `raw_events_bnb` | 3011          |
| Polygon | `poly` | `raw_events_poly`| 3012          |
| Solana  | `sol`  | `raw_events_sol` | 3013          |
| Tron    | `trc`  | `raw_events_trc` | 3014          |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Blockchain     │────▶│  Listener Engine │────▶│  Redis Queue    │
│  (RPC)          │     │  (per chain)     │     │  (raw_events_*) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  PostgreSQL      │
                        │  (checkpoint)    │
                        └──────────────────┘
```

## Features

- **Multi-chain support**: ETH, BSC, Polygon, Solana, Tron
- **Token filtering**: Only USDT, USDC, DAI transfers
- **Checkpoint management**: Resumes from last processed block on restart
- **Replay mode**: Catches up on missed blocks before going real-time
- **Health endpoints**: Detailed status including lag and mode
- **Container-based**: Each chain runs as a separate container

## Raw Event Structure

Events pushed to Redis queues have this structure:

```json
{
  "chain": "eth",
  "blockNumber": 19500000,
  "txHash": "0x...",
  "logIndex": 42,
  "from": "0x...",
  "to": "0x...",
  "amount": "1000000000",
  "tokenSymbol": "USDT",
  "tokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "timestamp": 1700000000
}
```

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose
- PostgreSQL (via docker-compose)
- Redis (via docker-compose)

### 1. Install Dependencies

From the root `escrowly-backend` directory:

```bash
npm install
```

### 2. Configure Environment

```bash
cd services/listener-engine
cp .env.example .env
```

Edit `.env` with your RPC URLs:

```env
CHAIN=eth
ETH_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
```

### 3. Generate Prisma Client

From root:

```bash
npm run listener:prisma:generate
```

### 4. Run Migrations

```bash
npm run listener:prisma:migrate
```

### 5. Start the Service (single instance, all chains)

By default, the service now runs **all chains in one process** (`CHAIN=all`):

```bash
CHIAN=all npm run listener:dev
```

To limit to specific chains, pass a comma-separated list:

```bash
CHAIN=eth,bnb,poly npm run listener:dev
```

Docker (all chains, single instance):

```bash
docker-compose up -d listener-engine
```

Docker (legacy multi-container mode still supported):

```bash
docker-compose up -d listener-eth listener-bnb listener-poly listener-sol listener-trc
```

## API Endpoints

### Health Check

```bash
# Detailed health
GET /api/v1/health

# Liveness probe (Kubernetes)
GET /api/v1/health/live

# Readiness probe (Kubernetes)
GET /api/v1/health/ready

# Listener-specific status
GET /api/v1/health/listener
```

The health response now includes **per-chain** listener status and aggregate state.

### Example Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "listener-engine",
  "chains": ["eth", "bnb", "poly", "sol", "trc"],
  "uptime": 3600,
  "checks": {
    "database": { "status": "ok", "latency": 5 },
    "redis": { "status": "ok", "latency": 2 },
    "listener": {
      "status": "ok",
      "aggregateLag": 5,
      "chains": {
        "eth": {
          "status": "ok",
          "mode": "realtime",
          "lastProcessedBlock": 19500000,
          "currentChainBlock": 19500005,
          "lag": 5,
          "eventsProcessed": 1234
        },
        "bnb": { "status": "ok", "lag": 3, "eventsProcessed": 456 },
        "poly": { "status": "ok", "lag": 2, "eventsProcessed": 789 },
        "sol": { "status": "ok", "lag": 1, "eventsProcessed": 321 },
        "trc": { "status": "ok", "lag": 4, "eventsProcessed": 654 }
      }
    }
  }
}
```

## Environment Variables

| Variable          | Description                    | Default                        |
| ----------------- | ------------------------------ | ------------------------------ |
| `NODE_ENV`        | Environment                    | `development`                  |
| `PORT`            | Service port                   | `3003`                         |
| `CHAIN`           | Chain to listen (eth/bnb/poly/sol/trc) | `eth`                 |
| `DATABASE_URL`    | PostgreSQL connection string   | (required)                     |
| `REDIS_URL`       | Redis connection string        | `redis://localhost:6379`       |
| `ETH_RPC_URL`     | Ethereum RPC endpoint          | (required for eth)             |
| `BSC_RPC_URL`     | BSC RPC endpoint               | (required for bnb)             |
| `POLYGON_RPC_URL` | Polygon RPC endpoint           | (required for poly)            |
| `SOLANA_RPC_URL`  | Solana RPC endpoint            | (required for sol)             |
| `TRON_RPC_URL`    | Tron RPC endpoint              | (required for trc)             |

## Database Schema

The service uses `listener_engine_db` schema with a single table:

```sql
CREATE TABLE listener_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain VARCHAR(10) NOT NULL,
  listener_type VARCHAR(20) DEFAULT 'deposit',
  last_processed_block BIGINT DEFAULT 0,
  confirmations INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (chain, listener_type)
);
```

## Deployment

### Docker Compose

All 5 listeners are defined in the root `docker-compose.yml`:

```bash
# Start all listeners
docker-compose up -d listener-eth listener-bnb listener-poly listener-sol listener-trc

# View logs
docker-compose logs -f listener-eth

# Stop all
docker-compose stop listener-eth listener-bnb listener-poly listener-sol listener-trc
```

### Kubernetes

Each listener should be deployed as a separate Deployment with:
- `CHAIN` env var set appropriately
- Liveness probe: `/api/v1/health/live`
- Readiness probe: `/api/v1/health/ready`
- Restart policy: Always

## Troubleshooting

### Listener not starting

1. Check RPC URL is configured correctly
2. Verify database connection: `npm run listener:prisma:studio`
3. Check Redis connection in health endpoint

### Falling behind (high lag)

1. Check RPC rate limits
2. Consider using a dedicated RPC provider
3. Monitor block processing time in logs

### Events not appearing in Redis

1. Check Redis connection in health endpoint
2. Verify queue name matches expected pattern
3. Check token addresses in chain config

---

**Service Status**: ✅ Ready for Development
**Last Updated**: December 2024

