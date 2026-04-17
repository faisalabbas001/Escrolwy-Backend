# @escrowly/kafka-publisher

Reliable Kafka event publishing using the **Transactional Outbox Pattern** for NestJS microservices.

## Overview

This package provides a DB-agnostic solution for reliable event publishing. It ensures events are never lost, even when Kafka is down or services crash.

### Key Features

- **DB-Agnostic**: Works with any database/ORM via adapter pattern
- **Transactional Guarantees**: Events written in same transaction as business data
- **Automatic Retries**: Exponential backoff with configurable retry limits
- **Safe Concurrency**: Multiple instances can run safely using database-level locking
- **Idempotent**: Prevents duplicate events through multiple layers of defense
- **Observable**: Structured logging and optional metrics

## Architecture

The package follows the Transactional Outbox Pattern:

1. **Business Logic**: Writes events to outbox table in same DB transaction
2. **Outbox Processor**: Polls outbox table and publishes to Kafka
3. **Failure Recovery**: Retries failed events with exponential backoff
4. **Idempotency**: Multiple layers prevent duplicate processing

## Installation

```bash
npm install @escrowly/kafka-publisher
```

## Quick Start

### 1. Implement OutboxAdapter

Each service must implement `OutboxAdapter` for their database:

```typescript
// prisma-outbox.adapter.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OutboxAdapter, OutboxEvent } from '@escrowly/kafka-publisher';

@Injectable()
export class PrismaOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    // Use FOR UPDATE SKIP LOCKED for safe concurrent processing
    return this.prisma.$queryRaw`
      SELECT * FROM outbox_events
      WHERE status = 'pending' 
         OR (status = 'failed' AND retry_count < 5 AND next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        lastError: null,
      },
    });
  }

  async markFailed(
    id: string,
    error: string,
    retryCount: number,
    nextRetryAt: Date,
  ): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'failed',
        retryCount,
        lastError: error,
        nextRetryAt,
      },
    });
  }

  async markPermanentlyFailed(
    id: string,
    error: string,
    retryCount: number,
  ): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'failed',
        retryCount,
        lastError: error,
        nextRetryAt: null,
      },
    });
  }
}
```

### 2. Register Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { KafkaModule } from '@escrowly/kafka-core';
import { PrismaOutboxAdapter } from './adapters/prisma-outbox.adapter';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: 'escrow-service',
      groupId: 'escrow-service-group',
      brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
    }),
    KafkaPublisherModule.forRoot({
      adapter: PrismaOutboxAdapter,
      config: {
        pollingIntervalMs: 2000,
        batchSize: 20,
        maxRetries: 5,
        baseBackoffMs: 5000,
        maxBackoffMs: 60000,
      },
    }),
  ],
})
export class AppModule {}
```

### 3. Write Events to Outbox

In your business logic, write events to the outbox table in the same transaction:

```typescript
// escrow.service.ts
async createEscrow(dto: CreateEscrowDto): Promise<Escrow> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Create escrow
    const escrow = await tx.escrow.create({ data: {...} });

    // 2. Write event to outbox (same transaction)
    await tx.outboxEvent.create({
      data: {
        topic: EscrowTopics.CREATED,
        partitionKey: escrow.id,
        payload: JSON.stringify({
          escrow: { ...escrow },
          initiatedBy: userId,
        }),
        status: 'pending',
      },
    });

    return escrow;
  });
}
```

The publisher will automatically process events in the background.

## Configuration

### PublisherConfig

```typescript
interface PublisherConfig {
  pollingIntervalMs?: number;  // Default: 2000
  batchSize?: number;          // Default: 20
  maxRetries?: number;         // Default: 5
  baseBackoffMs?: number;      // Default: 5000
  maxBackoffMs?: number;       // Default: 60000
  enableMetrics?: boolean;      // Default: false
}
```

## Outbox Table Schema

Your outbox table must have these fields (names can vary, adapter maps them):

```sql
CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON string
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | published | failed
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP,
  next_retry_at TIMESTAMP
);

CREATE INDEX idx_outbox_status ON outbox_events(status);
CREATE INDEX idx_outbox_created_at ON outbox_events(created_at);
CREATE INDEX idx_outbox_next_retry_at ON outbox_events(next_retry_at);
```

## Concurrency & Scaling

### Multiple Instances

The package supports running multiple publisher instances safely:

- Uses `FOR UPDATE SKIP LOCKED` for database-level locking
- Each instance processes different events
- No duplicate processing

### Horizontal Scaling

You can scale horizontally by:

1. Running multiple service instances
2. Each instance runs its own publisher
3. Database locking ensures safe distribution

## Failure Scenarios

### Kafka Down

- Events remain in outbox
- Publisher retries with exponential backoff
- When Kafka recovers, events are published automatically

### Service Crash

- Events persist in database
- On restart, publisher resumes processing
- No data loss

### Duplicate Prevention

Three-layer defense:

1. **Database Locking**: Prevents concurrent processing
2. **Kafka Producer Idempotence**: Prevents duplicates at Kafka level
3. **Consumer Deduplication**: Consumers check `eventId` in metadata

## API Reference

### PublisherService

```typescript
class PublisherService {
  /**
   * Trigger immediate processing of pending events
   */
  triggerProcessing(): Promise<void>;
}
```

### OutboxAdapter

```typescript
interface OutboxAdapter {
  findPendingEvents(limit: number): Promise<OutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string, retryCount: number, nextRetryAt: Date): Promise<void>;
  markPermanentlyFailed(id: string, error: string, retryCount: number): Promise<void>;
}
```

## Best Practices

1. **Always use transactions**: Write events in same transaction as business data
2. **Use FOR UPDATE SKIP LOCKED**: Required for safe concurrent processing
3. **Monitor retries**: Set up alerts for events that exceed retry limits
4. **Idempotent consumers**: Always check `eventId` in consumer handlers
5. **Test failure scenarios**: Verify behavior when Kafka is down

## Examples

See the `examples/` directory for complete adapter implementations for:
- Prisma (PostgreSQL)
- TypeORM (PostgreSQL)
- Sequelize (PostgreSQL)

## License

MIT

