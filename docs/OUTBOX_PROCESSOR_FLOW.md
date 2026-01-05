# OutboxProcessorService - Complete Flow Explanation

## Overview

`OutboxProcessorService` is the core worker that automatically polls your outbox table and publishes events to Kafka. Here's how it works step-by-step.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE STARTS                                │
│  NestJS calls onModuleInit() automatically                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  onModuleInit()                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Check if Kafka is enabled                              │  │
│  │ 2. Call start() to begin polling                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  start()                                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Creates setInterval timer                                  │  │
│  │ Runs processBatch() every 2 seconds (configurable)        │  │
│  │                                                             │  │
│  │ setInterval(() => {                                        │  │
│  │   processBatch().catch(...)                                │  │
│  │ }, pollingIntervalMs)                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Every 2 seconds
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  processBatch()                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Check if already processing (prevent concurrent runs)  │  │
│  │ 2. Set isProcessing = true                                │  │
│  │ 3. Call adapter.findPendingEvents(batchSize)              │  │
│  │    ↓                                                       │  │
│  │    Queries: SELECT * FROM outbox_events                   │  │
│  │             WHERE status='pending'                         │  │
│  │             FOR UPDATE SKIP LOCKED                        │  │
│  │             LIMIT 20                                      │  │
│  │ 4. If no events → return (wait for next poll)             │  │
│  │ 5. Loop through events → call processEvent()             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ For each event
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  processEvent(event)                                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ TRY BLOCK:                                                 │  │
│  │                                                             │  │
│  │ 1. Parse JSON payload                                      │  │
│  │    payload = JSON.parse(event.payload)                    │  │
│  │    ↓                                                       │  │
│  │    If parse fails → markPermanentlyFailed() → RETURN      │  │
│  │                                                             │  │
│  │ 2. Check if already published                              │  │
│  │    if (status === 'published') → RETURN                    │  │
│  │                                                             │  │
│  │ 3. Publish to Kafka                                        │  │
│  │    await kafka.produce(topic, payload, partitionKey)      │  │
│  │    ↓                                                       │  │
│  │    If fails → CATCH BLOCK                                  │  │
│  │                                                             │  │
│  │ 4. Mark as published                                       │  │
│  │    await adapter.markPublished(event.id)                   │  │
│  │    ↓                                                       │  │
│  │    Updates: status = 'published'                          │  │
│  │                                                             │  │
│  │ SUCCESS ✅ → Event published, status updated               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            │ If Kafka publish fails              │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ CATCH BLOCK:                                               │  │
│  │                                                             │  │
│  │ 1. Increment retry count                                   │  │
│  │    retryCount = event.retryCount + 1                       │  │
│  │                                                             │  │
│  │ 2. Check if max retries exceeded                          │  │
│  │    if (retryCount >= maxRetries) {                         │  │
│  │      → markPermanentlyFailed() → RETURN                   │  │
│  │    }                                                        │  │
│  │                                                             │  │
│  │ 3. Calculate exponential backoff                          │  │
│  │    backoffMs = baseBackoffMs * 2^retryCount                │  │
│  │    nextRetryAt = now + backoffMs                           │  │
│  │                                                             │  │
│  │ 4. Mark as failed with retry schedule                     │  │
│  │    await adapter.markFailed(id, error, retryCount,         │  │
│  │                            nextRetryAt)                    │  │
│  │    ↓                                                       │  │
│  │    Updates: status = 'failed',                            │  │
│  │              retryCount = X,                               │  │
│  │              nextRetryAt = timestamp                       │  │
│  │                                                             │  │
│  │ RETRY SCHEDULED ⏰ → Will retry later                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Back to processBatch()
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  processBatch() continues                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ After processing all events:                              │  │
│  │ 1. Set isProcessing = false                                │  │
│  │ 2. Return (wait for next poll in 2 seconds)               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Timer fires again (2 seconds later)
                            ▼
                    [LOOP CONTINUES...]
```

---

## Function-by-Function Breakdown

### 1. Constructor - Initialization

```typescript
constructor(
  private readonly adapter: OutboxAdapter,      // ← Service's adapter (queries DB)
  private readonly kafka: KafkaService,         // ← Kafka client
  private readonly config: PublisherConfig = {}, // ← Configuration
) {
  // Set defaults from config
  this.pollingIntervalMs = config.pollingIntervalMs ?? 2000;  // Default: 2 seconds
  this.batchSize = config.batchSize ?? 20;                  // Default: 20 events
  this.maxRetries = config.maxRetries ?? 5;                 // Default: 5 retries
  this.baseBackoffMs = config.baseBackoffMs ?? 5000;         // Default: 5 seconds
  this.maxBackoffMs = config.maxBackoffMs ?? 60000;         // Default: 60 seconds
}
```

**What it does:**
- Receives dependencies via dependency injection
- Sets configuration with sensible defaults
- Stores references for later use

---

### 2. onModuleInit() - Service Startup

```typescript
async onModuleInit(): Promise<void> {
  // Check if Kafka is enabled
  if (!this.kafka.isEnabled) {
    this.logger.warn('Kafka is disabled, outbox processor will not start');
    return;  // ← Don't start if Kafka is disabled
  }
  
  // Start the polling timer
  this.start();
}
```

**Flow:**
```
Service Starts
    ↓
NestJS calls onModuleInit()
    ↓
Check Kafka enabled?
    ├─ No → Log warning, return (don't start)
    └─ Yes → Call start()
```

**When it runs:** Automatically when NestJS module initializes

---

### 3. start() - Begin Polling

```typescript
private start(): void {
  // Prevent duplicate timers
  if (this.timer || this.shouldStop) return;
  
  // Create interval timer
  this.timer = setInterval(() => {
    // Every pollingIntervalMs (default: 2000ms)
    this.processBatch().catch((err) =>
      this.logger.error(`Outbox batch processing failed: ${err.message}`, err.stack)
    );
  }, this.pollingIntervalMs);
  
  // Log startup
  this.logger.log(
    `Outbox processor started (polling every ${this.pollingIntervalMs}ms, batch size: ${this.batchSize})`
  );
}
```

**Flow:**
```
start() called
    ↓
Create setInterval timer
    ↓
Every 2 seconds → Call processBatch()
    ↓
If error → Log error (don't crash)
    ↓
Timer keeps running...
```

**What it does:**
- Creates a background timer that runs continuously
- Calls `processBatch()` every 2 seconds
- Handles errors gracefully (logs but doesn't crash)

---

### 4. processBatch() - Main Processing Loop

```typescript
private async processBatch(): Promise<void> {
  // 1. Prevent concurrent execution
  if (this.isProcessing || this.shouldStop) return;
  
  // 2. Mark as processing
  this.isProcessing = true;

  try {
    // 3. Query database for pending events
    let events: OutboxEvent[];
    try {
      events = await this.adapter.findPendingEvents(this.batchSize);
      // ↑ Calls adapter → queries DB → returns events
    } catch (dbError: any) {
      // Database error - log and exit
      this.logger.error(`Database error: ${dbError.message}`);
      this.isProcessing = false;
      return;
    }

    // 4. Check if any events found
    if (!events.length) {
      this.isProcessing = false;
      return;  // ← No events, wait for next poll
    }

    // 5. Log processing start
    this.logger.debug(`Processing ${events.length} outbox event(s)`);

    // 6. Process each event sequentially
    for (const event of events) {
      // Check if shutdown requested
      if (this.shouldStop) {
        this.logger.log('Stopping processing due to shutdown signal');
        break;
      }

      // Process individual event
      await this.processEvent(event);
    }
    
  } catch (error: any) {
    // Unexpected error - log but don't crash
    this.logger.error(`Unexpected error: ${error.message}`, error.stack);
  } finally {
    // Always reset processing flag
    this.isProcessing = false;
  }
}
```

**Flow:**
```
Timer fires → processBatch()
    ↓
Check: Already processing? → Yes → Return (skip)
    ↓
Set isProcessing = true
    ↓
Query DB: adapter.findPendingEvents(20)
    ├─ Error → Log, return
    ├─ No events → Return (wait for next poll)
    └─ Found events → Continue
    ↓
For each event:
    ├─ Check shutdown → Yes → Break loop
    └─ Call processEvent(event)
    ↓
Set isProcessing = false
    ↓
Return (wait for next poll in 2 seconds)
```

**Key features:**
- ✅ Prevents concurrent execution (`isProcessing` flag)
- ✅ Handles database errors gracefully
- ✅ Processes events sequentially (one at a time)
- ✅ Respects shutdown signal

---

### 5. processEvent() - Process Single Event

```typescript
private async processEvent(event: OutboxEvent): Promise<void> {
  try {
    // ──────────────────────────────────────────────────────────
    // STEP 1: Parse JSON Payload
    // ──────────────────────────────────────────────────────────
    let payload: any;
    try {
      payload = JSON.parse(event.payload);
      // ↑ Convert string to object
    } catch (parseError: any) {
      // Corrupted JSON - can't retry
      this.logger.error(`Failed to parse payload ${event.id}: ${parseError.message}`);
      await this.adapter.markPermanentlyFailed(
        event.id,
        `Invalid JSON payload: ${parseError.message}`,
        event.retryCount
      );
      return;  // ← Exit, don't retry corrupted data
    }

    // ──────────────────────────────────────────────────────────
    // STEP 2: Defense Check - Already Published?
    // ──────────────────────────────────────────────────────────
    if (event.status === 'published') {
      this.logger.warn(`Event ${event.id} already published, skipping`);
      return;  // ← Already done, skip
    }

    // ──────────────────────────────────────────────────────────
    // STEP 3: Publish to Kafka
    // ──────────────────────────────────────────────────────────
    await this.kafka.produce(
      event.topic,        // e.g., 'escrow.created'
      payload,            // Parsed JSON object
      event.partitionKey  // e.g., escrow.id
    );
    // ↑ If this fails → CATCH BLOCK

    // ──────────────────────────────────────────────────────────
    // STEP 4: Mark as Published
    // ──────────────────────────────────────────────────────────
    try {
      await this.adapter.markPublished(event.id);
      // ↑ Updates: status = 'published', publishedAt = now()
      this.logger.debug(`Published event ${event.id} to topic ${event.topic}`);
    } catch (dbError: any) {
      // Kafka published but DB update failed
      // Event is already in Kafka, so it's OK
      this.logger.error(`Published to Kafka but DB update failed: ${dbError.message}`);
      // Don't retry - event is already published to Kafka
    }
    
    // ──────────────────────────────────────────────────────────
    // SUCCESS PATH ✅
    // ──────────────────────────────────────────────────────────
    
  } catch (err: any) {
    // ──────────────────────────────────────────────────────────
    // ERROR PATH - Kafka publish failed
    // ──────────────────────────────────────────────────────────
    
    // 1. Increment retry count
    const retryCount = event.retryCount + 1;
    
    // 2. Check if max retries exceeded
    const isExhausted = retryCount >= this.maxRetries;
    
    if (isExhausted) {
      // Give up after max retries
      this.logger.error(
        `Outbox publish failed (giving up) ${event.topic} (${event.id}): ${err.message}`
      );
      await this.adapter.markPermanentlyFailed(event.id, err.message, retryCount);
      return;  // ← Don't retry anymore
    }

    // 3. Calculate exponential backoff
    const backoffMs = this.calculateBackoff(retryCount);
    // Retry 1: 5 seconds
    // Retry 2: 10 seconds
    // Retry 3: 20 seconds
    // Retry 4: 40 seconds
    // Retry 5: 60 seconds (max)
    
    const nextRetryAt = new Date(Date.now() + backoffMs);

    // 4. Log retry schedule
    this.logger.warn(
      `Outbox publish failed (retry ${retryCount}/${this.maxRetries}) ` +
      `${event.topic} (${event.id}): ${err.message}. ` +
      `Next retry at ${nextRetryAt.toISOString()}`
    );

    // 5. Mark as failed with retry schedule
    try {
      await this.adapter.markFailed(
        event.id,
        err.message,
        retryCount,
        nextRetryAt
      );
      // ↑ Updates: status = 'failed', retryCount = X, nextRetryAt = timestamp
    } catch (dbError: any) {
      // DB error while updating retry - log but don't fail batch
      this.logger.error(`DB error updating retry: ${dbError.message}`);
    }
    
    // ──────────────────────────────────────────────────────────
    // RETRY SCHEDULED ⏰
    // ──────────────────────────────────────────────────────────
  }
}
```

**Flow:**
```
processEvent(event)
    ↓
TRY:
    ├─ Parse JSON payload
    │   ├─ Success → Continue
    │   └─ Fail → markPermanentlyFailed() → RETURN
    │
    ├─ Check if already published
    │   └─ Yes → RETURN (skip)
    │
    ├─ Publish to Kafka
    │   ├─ Success → Continue
    │   └─ Fail → CATCH BLOCK
    │
    └─ Mark as published
        ├─ Success → DONE ✅
        └─ Fail → Log error (event already in Kafka)
    
CATCH (Kafka publish failed):
    ├─ Increment retryCount
    ├─ Check max retries exceeded?
    │   ├─ Yes → markPermanentlyFailed() → RETURN ❌
    │   └─ No → Continue
    │
    ├─ Calculate backoff delay
    ├─ Schedule next retry
    └─ markFailed() → RETRY SCHEDULED ⏰
```

**Key features:**
- ✅ Validates JSON before processing
- ✅ Handles corrupted data (marks as permanently failed)
- ✅ Retries on Kafka failures
- ✅ Exponential backoff (5s → 10s → 20s → 40s → 60s)
- ✅ Gives up after max retries

---

### 6. calculateBackoff() - Exponential Backoff

```typescript
private calculateBackoff(retryCount: number): number {
  // Formula: baseBackoffMs * 2^retryCount
  // Example: 5000 * 2^1 = 10000ms (10 seconds)
  const delay = this.baseBackoffMs * Math.pow(2, retryCount);
  
  // Cap at maximum backoff
  return Math.min(delay, this.maxBackoffMs);
}
```

**Example calculations:**
```
Retry 1: 5000 * 2^1 = 10,000ms  (10 seconds)
Retry 2: 5000 * 2^2 = 20,000ms  (20 seconds)
Retry 3: 5000 * 2^3 = 40,000ms  (40 seconds)
Retry 4: 5000 * 2^4 = 80,000ms  → Capped at 60,000ms (60 seconds)
Retry 5: 5000 * 2^5 = 160,000ms → Capped at 60,000ms (60 seconds)
```

**Why exponential backoff?**
- Prevents overwhelming Kafka when it's down
- Gives Kafka time to recover
- Reduces unnecessary retry attempts

---

### 7. classifyError() - Error Classification

```typescript
private classifyError(error: any): string {
  const message = error?.message?.toLowerCase() || '';
  
  if (
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('enotfound') ||
    message.includes('econnrefused')
  ) {
    return 'INFRASTRUCTURE';  // ← Network/Kafka issues
  }
  
  if (
    message.includes('database') ||
    message.includes('prisma') ||
    message.includes('query')
  ) {
    return 'DATABASE';  // ← Database issues
  }
  
  if (message.includes('validation') || message.includes('invalid')) {
    return 'VALIDATION';  // ← Data validation issues
  }
  
  return 'UNKNOWN';  // ← Other errors
}
```

**Purpose:** Helps with logging and debugging by categorizing errors

---

### 8. trigger() - Manual Trigger

```typescript
async trigger(): Promise<void> {
  // Don't trigger if already processing or shutting down
  if (this.isProcessing || this.shouldStop) return;
  
  // Process immediately (don't wait for next poll)
  await this.processBatch();
}
```

**Use case:** When you want to process events immediately instead of waiting for next poll

**Example:**
```typescript
// After writing event
await prisma.outboxEvent.create({ ... });

// Trigger immediate processing
await publisherService.triggerProcessing();
// ↑ Processes events right away instead of waiting 2 seconds
```

---

### 9. onModuleDestroy() - Graceful Shutdown

```typescript
async onModuleDestroy(): Promise<void> {
  // 1. Signal shutdown
  this.shouldStop = true;
  
  // 2. Stop the timer
  this.stop();
  
  // 3. Wait for current processing to finish
  while (this.isProcessing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    // ↑ Check every 100ms if processing is done
  }
  
  // 4. Log shutdown complete
  this.logger.log('Outbox processor stopped');
}
```

**Flow:**
```
Service shutting down
    ↓
NestJS calls onModuleDestroy()
    ↓
Set shouldStop = true
    ↓
Stop timer (no more polls)
    ↓
Wait for current processBatch() to finish
    ↓
Log "stopped"
```

**Why wait?** Ensures events being processed aren't interrupted mid-way

---

## Complete Example Timeline

```
00:00.000 - Service starts
            ↓
00:00.000 - onModuleInit() → start()
            ↓
00:00.000 - Timer created (every 2 seconds)
            ↓
00:00.000 - First poll: processBatch()
            ├─ Query DB: No events found
            └─ Return (wait for next poll)
            ↓
00:02.000 - Second poll: processBatch()
            ├─ Query DB: No events found
            └─ Return (wait for next poll)
            ↓
00:05.123 - Developer writes event to outbox_events
            Status: 'pending'
            ↓
00:06.000 - Third poll: processBatch()
            ├─ Query DB: Found 1 event!
            ├─ Call processEvent(event)
            │   ├─ Parse JSON ✅
            │   ├─ Publish to Kafka ✅
            │   └─ Mark as published ✅
            └─ Return
            ↓
00:08.000 - Fourth poll: processBatch()
            ├─ Query DB: No events found
            └─ Return
            ↓
... continues polling every 2 seconds ...
```

---

## Error Scenario Timeline

```
00:00.000 - Event written (status: 'pending')
            ↓
00:02.000 - First poll: processBatch()
            ├─ Query DB: Found event
            ├─ Call processEvent(event)
            │   ├─ Parse JSON ✅
            │   ├─ Publish to Kafka ❌ (Kafka is down!)
            │   └─ CATCH BLOCK:
            │       ├─ retryCount = 1
            │       ├─ backoffMs = 10 seconds
            │       ├─ nextRetryAt = 00:02.010
            │       └─ markFailed() → status = 'failed'
            └─ Return
            ↓
00:12.000 - Poll: processBatch()
            ├─ Query DB: Found failed event (nextRetryAt <= now)
            ├─ Call processEvent(event)
            │   ├─ Parse JSON ✅
            │   ├─ Publish to Kafka ❌ (Still down!)
            │   └─ CATCH BLOCK:
            │       ├─ retryCount = 2
            │       ├─ backoffMs = 20 seconds
            │       ├─ nextRetryAt = 00:12.020
            │       └─ markFailed()
            └─ Return
            ↓
00:32.000 - Poll: processBatch()
            ├─ Query DB: Found failed event (nextRetryAt <= now)
            ├─ Call processEvent(event)
            │   ├─ Parse JSON ✅
            │   ├─ Publish to Kafka ✅ (Kafka recovered!)
            │   └─ Mark as published ✅
            └─ Return
```

---

## Summary

**Main Functions:**
1. **`onModuleInit()`** - Starts polling when service starts
2. **`start()`** - Creates background timer
3. **`processBatch()`** - Main loop: queries DB, processes events
4. **`processEvent()`** - Processes single event: parse → publish → update status
5. **`calculateBackoff()`** - Calculates retry delay (exponential)
6. **`trigger()`** - Manual immediate processing
7. **`onModuleDestroy()`** - Graceful shutdown

**Key Features:**
- ✅ Automatic background polling (every 2 seconds)
- ✅ Safe concurrent processing (prevents duplicate runs)
- ✅ Retry logic with exponential backoff
- ✅ Graceful error handling
- ✅ Graceful shutdown

**Flow:**
```
Timer → processBatch() → Query DB → processEvent() → Publish Kafka → Update Status
  ↑                                                                        │
  └────────────────────────────────────────────────────────────────────────┘
                          (Loop continues)
```

