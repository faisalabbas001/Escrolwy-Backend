# Listener Engine – Architecture & Flow Guide

This document explains how the Listener Engine service is structured, how it starts, how it processes blocks/events, and where to extend functionality.

## High-Level Responsibilities
- Listen for **Transfer** events of USDT, USDC, DAI on 5 chains (eth, bnb, poly, sol, trc).
- Push **raw** events into chain-specific Redis queues (`raw_events_*`).
- Persist `last_processed_block` in PostgreSQL (`listener_engine_db.listener_state`).
- Replay missing blocks on startup, then switch to real-time polling.
- (No reorg handling/confirmation logic here—handled by downstream Worker).

## Bootstrapping Flow
1. **Entry Point**: `src/main.ts`
   - Creates Nest app, sets global prefix `api`, enables versioning (`v1`), Swagger (non-prod), validation pipes, CORS, shutdown hooks.
2. **App Module**: `src/app.module.ts`
   - Imports: `ConfigModule` (env), `SecretsModule` (shared), `PrismaModule`, `RedisModule`, `HealthModule`, `ListenerModule`.
3. **ListenerService init**: `src/listener/listener.service.ts`
   - Reads `CHAIN` env → resolves chain config (`config/chain.config.ts`).
   - Instantiates the correct listener:
     - `EvmListener` for eth/bnb/poly.
     - `SolanaListener` for sol.
     - `TronListener` for trc.
   - Calls `start()` on the listener.

## Persistence & Config
- **Prisma**: `src/prisma/prisma.service.ts` uses `@escrowly/shared-config` to set `DATABASE_URL` and connects to `listener_engine_db`.
- **Schema**: `prisma/schema.prisma` defines `listener_state` with unique `(chain, listener_type)` and `last_processed_block`.
- **Redis**: `src/redis/redis.service.ts` (ioredis) pushes events to queues; `pushEvent`/`pushEvents` helpers.
- **Chain Config**: `src/config/chain.config.ts` holds RPC env keys, token addresses, queue names, block times, and helpers (`getChainConfig`, `isValidChainId`).

## Listener Abstractions
- **Interfaces**: `src/listener/interfaces/chain-listener.interface.ts`
  - `start()`, `stop()`, `getStatus()`, `getCurrentBlockHeight()`, `processBlock()`.
- **DTO**: `src/listener/dto/raw-event.dto.ts`
  - Standard raw event shape pushed to Redis.
- **BaseListener**: `src/listener/listeners/base.listener.ts`
  - Loads checkpoint (`listener_state`).
  - Replay loop: sequential `processBlock` from `last_processed_block + 1` to current RPC height; saves checkpoint each block.
  - Real-time loop: polls for new blocks using `blockTime` interval; processes every new block in order; saves checkpoint.
  - Provides `pushEvents` and checkpoint helpers.

### EVM Listener (`evm.listener.ts`)
- Uses `ethers` `JsonRpcProvider`.
- Fetches logs per block with `ERC20_TRANSFER_TOPIC`.
- Filters configured token addresses; parses `from`, `to`, `amount`, `txHash`, `logIndex`.
- Timestamp: current time (fast path) or block timestamp via `processBlockWithTimestamp` (slower, not used in main flow).
- Poll interval: `chainConfig.blockTime`.

### Solana Listener (`solana.listener.ts`)
- Uses `@solana/web3.js`.
- Treats slots as blocks; fetches block with transactions.
- Parses SPL token transfers (transfer/transferChecked) for configured mints.
- Poll interval: `blockTime * 2` (Solana is fast; slightly slower polling).

### Tron Listener (`tron.listener.ts`)
- Uses `tronweb`.
- For each block: fetch tx info, iterate logs, filter TRC20 Transfer events by topic and token address.
- Converts hex addresses to base58; parses amount from log data.
- Poll interval: `blockTime`.

## Health & Observability
- **Health endpoints**: `src/health/health.controller.ts`
  - `GET /api/v1/health` – DB, Redis, listener status (mode, lag, lastProcessedBlock, eventsProcessed).
  - `GET /api/v1/health/live` – liveness.
  - `GET /api/v1/health/ready` – readiness (DB, Redis, listener running).
  - `GET /api/v1/health/listener` – listener-specific view.
- **Logging**: Each listener uses `Logger`; Prisma logs queries in dev.

## Data Flow (per chain)
1. **Startup**: read checkpoint from `listener_state`.
2. **Replay**: fetch current RPC height → process blocks sequentially until caught up → save checkpoint each block.
3. **Real-time**: poll for new blocks; for each new block → `processBlock` → push matching Transfer events to Redis queue → save checkpoint.
4. **Redis Queues**: one per chain (`raw_events_eth`, `raw_events_bnb`, `raw_events_poly`, `raw_events_sol`, `raw_events_trc`).

## Docker & Run Modes
- **Dockerfile**: multi-stage build, generates Prisma client, builds service.
- **docker-compose.yml**: defines five services (`listener-eth`, `listener-bnb`, `listener-poly`, `listener-sol`, `listener-trc`) with ports 3010-3014.
- **NPM scripts (root)**:
  - `listener:dev`, `listener:build`, `listener:test`
  - `listener:prisma:generate`, `listener:prisma:migrate`, `listener:prisma:studio`

## Extending / Modifying
- **Add tokens**: update `config/chain.config.ts` for the target chain.
- **Change queues**: adjust `queueName` in chain config.
- **Adjust polling**: tune `blockTime` per chain to balance freshness vs RPC load.
- **Accurate timestamps**: for EVM, call `processBlockWithTimestamp`; ensure RPC throughput is acceptable.
- **New chains**: implement `IChainListener`, extend `ListenerService.createListener` switch, and add chain config.

## Not Implemented (Future Work)
- Primary/backup heartbeat and failover.
- Reorg handling/confirmation logic (intentionally delegated to Worker).
- Metrics/telemetry export.

