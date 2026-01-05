# Escrow Service - Kafka Integration

This module handles Kafka event production for the Escrow service using:
- `@escrowly/kafka-core` - Kafka infrastructure (client, topics, schemas)
- `@escrowly/kafka-publisher` - Reliable event publishing using Transactional Outbox Pattern

## Overview

The Escrow service is a **producer-only** service. It produces events when escrow state changes occur, which are consumed by:

- **Ledger Service** - For fund movements (reserve, release, refund, freeze)
- **Notification Service** - For user notifications (email, push, SMS)
- **Admin Service** - For dispute alerts
- **Analytics Service** - For metrics and reporting

### Reliable Event Publishing

We use the **Transactional Outbox Pattern** to ensure events are never lost:

1. **Write to Outbox**: Events are written to `outbox_events` table in the **same database transaction** as business data
2. **ACID Guarantee**: If business logic commits, the event is guaranteed to be persisted
3. **Background Processing**: `OutboxProcessor` automatically polls and publishes events to Kafka
4. **Failure Recovery**: If Kafka is down, events remain in outbox and are retried with exponential backoff
5. **Idempotency**: Multiple layers prevent duplicate events (database locking, Kafka producer idempotence, consumer deduplication)

## File Structure

```
services/escrow/src/kafka/
├── index.ts                    # Exports
├── produce-events.ts           # EscrowEventProducer class (writes to outbox)
├── prisma-outbox.adapter.ts   # PrismaOutboxAdapter (implements OutboxAdapter)
└── README.md                   # This file
```

## Setup

### 1. KafkaModule in AppModule

```typescript
// app.module.ts
import { KafkaModule } from '@escrowly/kafka-core';
import { KafkaPublisherModule } from '@escrowly/kafka-publisher';
import { PrismaOutboxAdapter } from './kafka/prisma-outbox.adapter';

@Module({
  imports: [
    // Kafka infrastructure
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: 'escrow-service',
        groupId: 'escrow-consumer-group',
        brokers: config.get('KAFKA_BROKERS', 'localhost:9092'),
        enabled: config.get('KAFKA_ENABLED', 'false') === 'true',
      }),
      inject: [ConfigService],
    }),

    // Reliable event publishing (Transactional Outbox Pattern)
    KafkaPublisherModule.forRoot({
      adapter: PrismaOutboxAdapter,
      config: {
        pollingIntervalMs: 2000,  // Poll every 2 seconds
        batchSize: 20,              // Process 20 events per batch
        maxRetries: 5,              // Max retry attempts
        baseBackoffMs: 5000,        // Base backoff delay (5s)
        maxBackoffMs: 60000,        // Max backoff delay (60s)
      },
    }),
  ],
})
export class AppModule {}
```

### 2. EscrowEventProducer in EscrowModule

```typescript
// escrow.module.ts
import { EscrowEventProducer } from '../../kafka';
import { PublisherService } from '@escrowly/kafka-publisher';

@Module({
  providers: [
    EscrowService,
    EscrowEventProducer,  // Writes events to outbox
    PublisherService,     // Optional: for triggering immediate processing
  ],
})
export class EscrowModule {}
```

### 3. Inject in EscrowService

```typescript
// escrow.service.ts
import { EscrowEventProducer } from '../../kafka';

@Injectable()
export class EscrowService {
  constructor(
    private readonly eventProducer: EscrowEventProducer,
  ) {}
}
```

## Available Events

| Method | Topic | When to Call | Ledger Action |
|--------|-------|--------------|---------------|
| `escrowCreated()` | `escrow.created` | New escrow created | - |
| `escrowAccepted()` | `escrow.accepted` | Seller accepts | - |
| `paymentCompleted()` | `escrow.payment.completed` | Buyer funds escrow | `reserve_funds` |
| `deliveryStarted()` | `escrow.delivery.started` | Seller ships | - |
| `inspectionCompleted()` | `escrow.inspection.completed` | Buyer inspects | `release_to_seller` (if accepted) |
| `escrowCompleted()` | `escrow.completed` | Successfully closed | `release_to_seller` |
| `escrowRefunded()` | `escrow.refunded` | Refund issued | `refund_to_buyer` |
| `escrowCancelled()` | `escrow.cancelled` | Cancelled | `refund_to_buyer` (if funded) |
| `disputeOpened()` | `escrow.disputed` | Dispute filed | `freeze_funds` |
| `disputeResolved()` | `escrow.resolved` | Admin resolves | varies |
| `forceClosed()` | `escrow.force.closed` | Admin force close | varies |

## Usage Examples

### After Creating Escrow (Transactional Outbox)

```typescript
async createEscrow(dto: CreateEscrowDto, userId: string) {
  // Use transaction to ensure atomicity
  return this.prisma.$transaction(async (tx) => {
    // 1. Create in database
    const escrow = await tx.escrow.create({ data: {...} });
    
    // 2. Log transition
    await tx.escrowTransition.create({ data: {...} });
    
    // 3. Write event to outbox (same transaction!)
    await tx.outboxEvent.create({
      data: {
        topic: EscrowTopics.CREATED,
        partitionKey: escrow.id,
        payload: JSON.stringify({
          escrow: this.toSnapshot(escrow),
          initiatedBy: userId,
        }),
        status: 'pending',
      },
    });
    
    return escrow;
  });
  
  // Note: OutboxProcessor automatically publishes events in background
  // No need to call kafka.produce() directly!
}
```

### Using EscrowEventProducer (Current Implementation)

The `EscrowEventProducer` currently tries Kafka first, then falls back to outbox on failure:

```typescript
async createEscrow(dto: CreateEscrowDto, userId: string) {
  // 1. Create escrow (in transaction)
  const escrow = await this.escrowRepository.create(dto, userId);
  
  // 2. Log transition
  await this.transitionRepository.create(...);
  
  // 3. Produce event (tries Kafka, falls back to outbox on failure)
  await this.eventProducer.escrowCreated(
    this.toSnapshot(escrow),
    userId,
  );
  
  return escrow;
}
```

**Note**: For true transactional outbox pattern, write directly to outbox table in the same transaction. The `EscrowEventProducer` will be updated to support this pattern in the future.

### After Payment

```typescript
async processPayment(escrowId: string, dto: PaymentDto, userId: string) {
  // 1. Update escrow state (in transaction)
  const escrow = await this.escrowRepository.updateState(escrowId, 'funded');
  
  // 2. Log transition
  await this.transitionRepository.create(...);
  
  // 3. Produce event (tries Kafka, falls back to outbox on failure)
  await this.eventProducer.paymentCompleted(
    escrow.id,
    escrow.buyerId,
    escrow.sellerId,
    escrow.amount,
    escrow.asset,
    escrow.chain,
    dto.transactionHash,
  );
  
  // OutboxProcessor will publish events from outbox automatically
  // Ledger service will receive escrow.payment.completed event
}
```

### After Dispute

```typescript
async fileDispute(escrowId: string, dto: DisputeDto, userId: string) {
  // 1. Update escrow state (in transaction)
  const escrow = await this.escrowRepository.updateState(escrowId, 'disputed');
  
  // 2. Log transition
  await this.transitionRepository.create(...);
  
  // 3. Produce event (tries Kafka, falls back to outbox on failure)
  await this.eventProducer.disputeOpened(
    escrow.id,
    userId,
    escrow.buyerId,
    escrow.sellerId,
    escrow.amount,
    escrow.asset,
    dto.reason,
    previousState,
    dto.evidence,
  );
  
  // OutboxProcessor will publish events from outbox automatically
  // Ledger service will freeze funds
}
```

### Best Practice: Direct Outbox Write (Future Enhancement)

For true transactional guarantees, write directly to outbox in the same transaction:

```typescript
async createEscrow(dto: CreateEscrowDto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Create escrow
    const escrow = await tx.escrow.create({ data: {...} });
    
    // 2. Log transition
    await tx.escrowTransition.create({ data: {...} });
    
    // 3. Write to outbox (same transaction - guaranteed atomicity)
    await tx.outboxEvent.create({
      data: {
        topic: EscrowTopics.CREATED,
        partitionKey: escrow.id,
        payload: JSON.stringify({
          escrow: this.toSnapshot(escrow),
          initiatedBy: userId,
        }),
        status: 'pending',
      },
    });
    
    return escrow;
  });
  
  // OutboxProcessor automatically publishes events in background
}
```

## Event Payload Structure

All events include metadata + payload:

```json
{
  "metadata": {
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-12-12T18:30:00.000Z",
    "eventType": "escrow.payment.completed",
    "source": "escrow-service",
    "version": "1.0.0",
    "correlationId": "request-trace-id"
  },
  "payload": {
    "escrowId": "escrow-uuid",
    "buyerId": "buyer-uuid",
    "sellerId": "seller-uuid",
    "amount": 1000.00,
    "asset": "USDT",
    "chain": "eth",
    "transactionHash": "0x...",
    "ledgerAction": "reserve_funds"
  }
}
```

## Ledger Actions

The `ledgerAction` field tells the Ledger service what to do:

| Action | Description |
|--------|-------------|
| `reserve_funds` | Move buyer's funds from spendable to reserved |
| `release_to_seller` | Transfer reserved funds to seller |
| `refund_to_buyer` | Return reserved funds to buyer |
| `freeze_funds` | Lock funds during dispute (no movement) |
| `unfreeze_funds` | Unlock frozen funds |

## Configuration

### Environment Variables

```env
# .env
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
```

### Publisher Configuration

Configured in `app.module.ts`:

```typescript
KafkaPublisherModule.forRoot({
  adapter: PrismaOutboxAdapter,
  config: {
    pollingIntervalMs: 2000,  // How often to poll for events
    batchSize: 20,              // Events per batch
    maxRetries: 5,              // Max retry attempts
    baseBackoffMs: 5000,        // Base delay for exponential backoff
    maxBackoffMs: 60000,        // Maximum delay (caps exponential growth)
  },
})
```

### Outbox Table Schema

The `outbox_events` table is defined in Prisma schema:

```prisma
model OutboxEvent {
  id           String    @id @default(uuid())
  topic        String
  partitionKey String
  payload      String    @db.Text
  status       String    @default("pending")
  retryCount   Int       @default(0)
  lastError    String?   @db.Text
  createdAt    DateTime  @default(now())
  publishedAt  DateTime?
  nextRetryAt  DateTime?
}
```

## Error Handling & Reliability

### Transactional Outbox Pattern

Events are written to the outbox table in the **same transaction** as business data. This ensures:

- **No Lost Events**: If business logic commits, event is guaranteed to be persisted
- **No Blocking**: Writing to outbox is fast (just a DB insert)
- **Automatic Retry**: OutboxProcessor retries failed publishes with exponential backoff
- **Kafka Down?**: Events remain in outbox until Kafka recovers

### How It Works

1. **Business Logic** writes event to `outbox_events` table (same transaction)
2. **OutboxProcessor** polls outbox every 2 seconds (configurable)
3. **Database Locking** (`FOR UPDATE SKIP LOCKED`) prevents concurrent processing
4. **Publish to Kafka** - if successful, mark as `published`
5. **On Failure** - mark as `failed`, schedule retry with exponential backoff
6. **Max Retries** - after 5 attempts, event is marked as permanently failed

### Failure Scenarios

**Kafka Down:**
- Event remains in outbox with status `failed`
- Retry scheduled with exponential backoff (5s, 10s, 20s, 40s, 60s)
- When Kafka recovers, event is automatically published

**Service Crash:**
- Events persist in database
- On restart, OutboxProcessor resumes polling
- No data loss

**Multiple Instances:**
- Database-level locking (`SKIP LOCKED`) ensures only one instance processes each event
- Horizontal scaling is safe

### Monitoring

Check outbox status:

```sql
-- Pending events
SELECT COUNT(*) FROM outbox_events WHERE status = 'pending';

-- Failed events (retrying)
SELECT COUNT(*) FROM outbox_events WHERE status = 'failed' AND next_retry_at <= NOW();

-- Permanently failed (exceeded max retries)
SELECT COUNT(*) FROM outbox_events WHERE status = 'failed' AND next_retry_at IS NULL;
```

## Testing

### Mock the Producer

```typescript
const mockEventProducer = {
  escrowCreated: jest.fn(),
  paymentCompleted: jest.fn(),
  escrowCompleted: jest.fn(),
  disputeOpened: jest.fn(),
  // ... other methods
};

const module = await Test.createTestingModule({
  providers: [
    EscrowService,
    { provide: EscrowEventProducer, useValue: mockEventProducer },
  ],
}).compile();
```

### Verify Events

```typescript
it('should produce escrow.created event', async () => {
  await service.createEscrow(dto, userId);
  
  expect(mockEventProducer.escrowCreated).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.any(String) }),
    userId,
  );
});
```

## Adding New Events

1. **Add topic** to `packages/kafka-core/src/topics.enum.ts`:
```typescript
export enum EscrowTopics {
  // ... existing
  NEW_EVENT = 'escrow.new.event',
}
```

2. **Add payload type** to `packages/kafka-core/src/event.schema.ts`:
```typescript
export interface NewEventPayload {
  escrowId: string;
  // ... fields
}
```

3. **Add method** to `produce-events.ts`:
```typescript
async newEvent(escrowId: string, ...): Promise<void> {
  const payload: NewEventPayload = { escrowId, ... };
  await this.produce(EscrowTopics.NEW_EVENT, escrowId, payload);
}
```

4. **Rebuild kafka-core**:
```bash
cd packages/kafka-core && npm run build
```

## Downstream Services

### Ledger Service (Consumer)

```typescript
// In ledger-service
this.kafka.subscribe<PaymentCompletedPayload>(
  EscrowTopics.PAYMENT_COMPLETED,
  async (event) => {
    if (event.payload.ledgerAction === 'reserve_funds') {
      await this.reserveFunds(
        event.payload.buyerId,
        event.payload.amount,
        event.payload.escrowId,
      );
    }
  },
);
```

### Notification Service (Consumer)

```typescript
// In notification-service
this.kafka.subscribe<EscrowCreatedPayload>(
  EscrowTopics.CREATED,
  async (event) => {
    await this.sendEmail(
      event.payload.escrow.sellerId,
      'New Escrow Request',
      `You have a new escrow request for ${event.payload.escrow.amount} ${event.payload.escrow.asset}`,
    );
  },
);
```

## Architecture Details

### Why Transactional Outbox?

**Problem**: Direct Kafka publish can fail, causing lost events or blocking business logic.

**Solution**: Write to outbox table in same transaction as business data, then publish asynchronously.

**Benefits**:
- ✅ ACID guarantee (event persisted if business logic commits)
- ✅ Non-blocking (fast DB insert vs slow Kafka publish)
- ✅ Automatic retry with exponential backoff
- ✅ Safe concurrent processing (database locking)
- ✅ No duplicate events (multiple layers of defense)

### OutboxProcessor Flow

```
┌─────────────────┐
│ Business Logic  │
│ (Transaction)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Write to Outbox │
│ (Same TX)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Outbox Table    │◄─────│ OutboxProcessor   │
│ (Persistent)    │      │ (Background Poll) │
└─────────────────┘      └────────┬──────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │ Kafka Broker │
                          └──────────────┘
```

## Related Documentation

- [@escrowly/kafka-core README](../../../../packages/kafka-core/README.md)
- [@escrowly/kafka-publisher README](../../../../packages/kafka-publisher/README.md)
- [Escrow Service API Docs](http://localhost:3004/docs)
- [Prisma Schema](../../prisma/schema.prisma)

