# How the Kafka Publisher Works

## Overview

The publisher automatically polls your `outbox_events` table and publishes events to Kafka. Here's how it works step-by-step.

---

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Service                            │
│                                                             │
│  1. Business Logic writes to outbox_events table           │
│     await prisma.outboxEvent.create({ ... })               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (outbox_events table)                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ id | topic | payload | status | retryCount | ...   │   │
│  │----|-------|---------|--------|-----------|--------│   │
│  │ 1  | escrow| {...}  |pending |     0     | ...    │   │
│  │ 2  | escrow| {...}  |pending |     0     | ...    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Polls every 2 seconds
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         OutboxProcessorService (Background Cron)            │
│                                                             │
│  • Automatically starts when service starts                 │
│  • Polls outbox_events every 2 seconds (configurable)     │
│  • Processes events in batches of 20 (configurable)         │
│  • Handles retries with exponential backoff                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Uses adapter to query DB
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              OutboxAdapter (Service-Specific)              │
│                                                             │
│  • Queries your service's database                          │
│  • Uses FOR UPDATE SKIP LOCKED for safe concurrent access  │
│  • Updates event status after publishing                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Publishes to Kafka
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kafka Broker                             │
│                                                             │
│  Topics: escrow.created, escrow.updated, etc.              │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### Step 1: Service Starts

```typescript
// services/escrow/src/app.module.ts
@Module({
  imports: [
    KafkaPublisherModule.forRoot({
      adapter: PrismaOutboxAdapter,  // ← Your adapter
      config: {
        pollingIntervalMs: 2000,      // ← Poll every 2 seconds
        batchSize: 20,                // ← Process 20 events at a time
      },
    }),
  ],
})
export class AppModule {}
```

**What happens:**
1. NestJS creates `OutboxProcessorService` instance
2. Service calls `onModuleInit()` automatically
3. Background polling timer starts

---

### Step 2: Background Polling Starts

```typescript
// OutboxProcessorService.onModuleInit()
async onModuleInit(): Promise<void> {
  if (!this.kafka.isEnabled) {
    this.logger.warn('Kafka is disabled, outbox processor will not start');
    return;
  }
  this.start();  // ← Starts the polling timer
}

private start(): void {
  // Set up interval timer
  this.timer = setInterval(() => {
    this.processBatch().catch((err) =>
      this.logger.error(`Outbox batch processing failed: ${err.message}`)
    );
  }, this.pollingIntervalMs);  // ← Every 2 seconds
  
  this.logger.log(
    `Outbox processor started (polling every ${this.pollingIntervalMs}ms, batch size: ${this.batchSize})`
  );
}
```

**What happens:**
- Timer runs every 2 seconds (configurable)
- Each tick calls `processBatch()`
- Runs continuously in background

---

### Step 3: Developer Writes Event to Outbox

```typescript
// In your service code (e.g., escrow.service.ts)
async createEscrow(data) {
  // 1. Create escrow
  const escrow = await prisma.escrow.create({ ... });
  
  // 2. Write event to outbox table
  await prisma.outboxEvent.create({
    id: uuid(),
    topic: 'escrow.created',
    partitionKey: escrow.id,
    payload: JSON.stringify({
      escrowId: escrow.id,
      buyerId: escrow.buyerId,
      amount: escrow.amount,
    }),
    status: 'pending',  // ← Starts as 'pending'
    retryCount: 0,
  });
  
  return escrow;
}
```

**What happens:**
- Event is saved to `outbox_events` table
- Status is `'pending'`
- Publisher will pick it up automatically (within 2 seconds)

---

### Step 4: Publisher Polls for Pending Events

```typescript
// OutboxProcessorService.processBatch()
private async processBatch(): Promise<void> {
  // 1. Query database for pending events
  const events = await this.adapter.findPendingEvents(this.batchSize);
  // ↑ Uses your adapter to query your database
  
  if (!events.length) {
    return;  // No events, wait for next poll
  }
  
  // 2. Process each event
  for (const event of events) {
    await this.processEvent(event);
  }
}
```

**What happens:**
- Adapter queries: `SELECT * FROM outbox_events WHERE status = 'pending' LIMIT 20`
- Uses `FOR UPDATE SKIP LOCKED` to prevent concurrent processing
- Returns up to 20 events

---

### Step 5: Process Each Event

```typescript
// OutboxProcessorService.processEvent()
private async processEvent(event: OutboxEvent): Promise<void> {
  try {
    // 1. Parse payload
    const payload = JSON.parse(event.payload);
    
    // 2. Publish to Kafka
    await this.kafka.produce(
      event.topic,           // e.g., 'escrow.created'
      payload,               // Parsed JSON object
      event.partitionKey     // e.g., escrow.id
    );
    
    // 3. Mark as published
    await this.adapter.markPublished(event.id);
    // ↑ Updates status to 'published' in database
    
  } catch (err) {
    // Handle errors (retry logic)
    await this.handleError(event, err);
  }
}
```

**What happens:**
- Parses JSON payload
- Publishes to Kafka topic
- Updates database: `status = 'published'`

---

### Step 6: Error Handling & Retries

```typescript
// If Kafka publish fails
catch (err) {
  const retryCount = event.retryCount + 1;
  
  if (retryCount >= this.maxRetries) {
    // Give up after 5 retries
    await this.adapter.markPermanentlyFailed(event.id, errorMessage, retryCount);
  } else {
    // Schedule retry with exponential backoff
    const backoffMs = this.calculateBackoff(retryCount);
    // Retry 1: wait 5 seconds
    // Retry 2: wait 10 seconds
    // Retry 3: wait 20 seconds
    // Retry 4: wait 40 seconds
    // Retry 5: wait 60 seconds (max)
    
    const nextRetryAt = new Date(Date.now() + backoffMs);
    await this.adapter.markFailed(event.id, errorMessage, retryCount, nextRetryAt);
  }
}
```

**What happens:**
- If Kafka is down, event stays in outbox
- Retry count increments
- Next retry scheduled with exponential backoff
- After 5 failures, marked as permanently failed

---

## Complete Example Flow

### Timeline

```
00:00.000 - Service starts
            ↓
00:00.000 - OutboxProcessorService starts polling timer
            ↓
00:00.000 - Timer: Check for events (none found)
00:02.000 - Timer: Check for events (none found)
00:04.000 - Timer: Check for events (none found)
            ↓
00:05.123 - Developer creates escrow
            ↓
00:05.124 - Event written to outbox_events table
            Status: 'pending'
            ↓
00:06.000 - Timer: Check for events (found 1 event!)
            ↓
00:06.001 - Process event:
            - Parse payload
            - Publish to Kafka topic 'escrow.created'
            - Update status to 'published'
            ↓
00:06.002 - Event successfully published ✅
            ↓
00:08.000 - Timer: Check for events (none found)
00:10.000 - Timer: Check for events (none found)
            ... continues polling ...
```

---

## Key Features

### 1. Automatic Background Processing

```typescript
// You don't need to do anything!
// Just write to outbox table, publisher handles the rest
await prisma.outboxEvent.create({ ... });
// ↑ Publisher automatically picks it up within 2 seconds
```

### 2. Safe Concurrent Processing

```sql
-- Uses database-level locking
SELECT * FROM outbox_events
WHERE status = 'pending'
FOR UPDATE SKIP LOCKED  -- ← Prevents multiple instances from processing same event
LIMIT 20
```

**Benefits:**
- Multiple service instances can run safely
- No duplicate processing
- No race conditions

### 3. Retry Logic

```typescript
// Exponential backoff
Retry 1: Wait 5 seconds   (5s)
Retry 2: Wait 10 seconds  (10s)
Retry 3: Wait 20 seconds  (20s)
Retry 4: Wait 40 seconds  (40s)
Retry 5: Wait 60 seconds  (60s max)
```

### 4. Graceful Shutdown

```typescript
// When service stops
async onModuleDestroy(): Promise<void> {
  this.shouldStop = true;
  this.stop();  // Stop timer
  
  // Wait for current processing to finish
  while (this.isProcessing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  this.logger.log('Outbox processor stopped');
}
```

---

## Configuration Options

```typescript
KafkaPublisherModule.forRoot({
  adapter: PrismaOutboxAdapter,
  config: {
    pollingIntervalMs: 2000,    // How often to poll (default: 2000ms)
    batchSize: 20,               // Events per batch (default: 20)
    maxRetries: 5,               // Max retry attempts (default: 5)
    baseBackoffMs: 5000,        // Initial backoff delay (default: 5000ms)
    maxBackoffMs: 60000,        // Max backoff delay (default: 60000ms)
  },
})
```

---

## Manual Trigger (Optional)

```typescript
// If you want to process immediately instead of waiting for next poll
@Injectable()
export class EscrowService {
  constructor(private readonly publisher: PublisherService) {}
  
  async createEscrow(data) {
    const escrow = await prisma.escrow.create({ ... });
    
    await prisma.outboxEvent.create({ ... });
    
    // Trigger immediate processing (optional)
    await this.publisher.triggerProcessing();
    // ↑ Processes events immediately instead of waiting for next poll
  }
}
```

---

## Event Status Lifecycle

```
pending → processing → published ✅
   ↓
failed (retry scheduled)
   ↓
failed (retry again)
   ↓
... (up to 5 retries)
   ↓
failed (permanently failed) ❌
```

---

## Summary

**How it works:**
1. ✅ Service starts → Publisher starts polling timer
2. ✅ Developer writes event to `outbox_events` table
3. ✅ Publisher polls every 2 seconds
4. ✅ Finds pending events
5. ✅ Publishes to Kafka
6. ✅ Updates status to 'published'
7. ✅ Handles errors with retries

**Key points:**
- **Automatic** - No manual intervention needed
- **Reliable** - Events never lost (stored in DB)
- **Resilient** - Retries on failure
- **Safe** - Handles concurrent processing
- **Configurable** - Adjust polling, batch size, retries

**Developer experience:**
```typescript
// That's it! Just write to outbox table
await prisma.outboxEvent.create({
  topic: 'escrow.created',
  payload: JSON.stringify(event),
});
// Publisher handles everything else automatically! 🚀
```

