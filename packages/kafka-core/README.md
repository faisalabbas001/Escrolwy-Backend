# @escrowly/kafka-core

Centralized Kafka infrastructure for Escrowly microservices. This package provides a unified way to produce and consume Kafka events across all services.

## 📁 Package Structure

```
packages/kafka-core/src/
│
├── index.ts                      # 📦 Main exports (single import point)
│
├── module/                       # 🔧 NestJS Integration
│   ├── kafka.module.ts           # Dynamic module (forRoot, forRootAsync)
│   └── index.ts
│
├── services/                 # 🚀 Core Kafka Services
│   ├── kafka.service.ts          # High-level API (produce + consume)
│   ├── kafka.producer.ts         # Producer implementation
│   ├── kafka.consumer.ts         # Consumer implementation
│   └── index.ts
│
├── constants/                    # 📋 Topic Definitions
│   ├── topics.enum.ts            # All Kafka topics (enums)
│   └── index.ts
│
└── schemas/                      # 📝 Event Types & Validation
    ├── event.schema.ts           # All payload interfaces
    ├── schema-validator.ts       # Event validation utilities
    └── index.ts
```

## Features

- 🚀 **Easy Integration** - Simple NestJS module with `forRoot` and `forRootAsync`
- 📝 **Type Safety** - All events are fully typed with TypeScript
- ✅ **Schema Validation** - Built-in event validation before produce/after consume
- 🔄 **Producer & Consumer** - Both producing and consuming in one package
- 📊 **Centralized Topics** - All topic names defined as enums
- 🔌 **Pluggable** - Enable/disable Kafka per environment
- 📁 **Organized** - Clean folder structure for better maintainability

## Installation

```bash
# The package is already part of the monorepo
# Just add to your service's package.json:
"@escrowly/kafka-core": "*"

# Then run from root:
npm install
```

## Quick Start

### Step 1: Import KafkaModule

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { KafkaModule } from "@escrowly/kafka-core";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Kafka with async config
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: "your-service-name",
        groupId: "your-consumer-group",
        brokers: config.get("KAFKA_BROKERS", "localhost:9092"),
        enabled: config.get("KAFKA_ENABLED", "false") === "true",
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Step 2: Create Event Producer

```typescript
// kafka/produce-events.ts
import { Injectable, Logger } from "@nestjs/common";
import {
  KafkaService,
  EscrowTopics,
  EscrowCreatedPayload,
  EscrowSnapshot,
} from "@escrowly/kafka-core";

@Injectable()
export class YourEventProducer {
  private readonly logger = new Logger(YourEventProducer.name);

  constructor(private readonly kafka: KafkaService) {}

  async onEscrowCreated(escrow: EscrowSnapshot, userId: string): Promise<void> {
    const payload: EscrowCreatedPayload = {
      escrow,
      initiatedBy: userId,
    };

    try {
      await this.kafka.produce(
        EscrowTopics.CREATED, // Topic enum
        payload, // Typed payload
        escrow.id // Partition key (for ordering)
      );
      this.logger.debug(`Produced escrow.created for ${escrow.id}`);
    } catch (error) {
      this.logger.error(`Failed to produce event: ${error.message}`);
    }
  }
}
```

### Minimal recipes

**Produce**

```ts
await kafkaService.produce(
  EscrowTopics.CREATED, // topic
  { escrow, initiatedBy: userId }, // payload
  escrow.id, // partition key
  correlationId // optional
);
```

**Consume**

```ts
kafkaService.subscribe<PaymentCompletedPayload>(
  EscrowTopics.PAYMENT_COMPLETED,
  async (event) => {
    // handle event.payload
  }
);
await kafkaService.startConsuming();
```

### Local/Windows-friendly broker config

- Set env: `KAFKA_ENABLED=true`, `KAFKA_BROKERS=localhost:9092`
- You can list multiple brokers comma-separated; the service trims and adds ports if missing.
- Avoid container hostnames like `redpanda` on the host; use `localhost:9092`.

## Full Example (ready to copy)

**.env**

```
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
```

**app.module.ts**

```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { KafkaModule } from "@escrowly/kafka-core";
import { DemoProducer } from "./kafka/demo.producer";
import { DemoConsumer } from "./kafka/demo.consumer";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: "demo-service",
        groupId: "demo-group",
        brokers: config.get("KAFKA_BROKERS", "localhost:9092"),
        enabled: config.get("KAFKA_ENABLED", "false") === "true",
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [DemoProducer, DemoConsumer],
})
export class AppModule {}
```

**kafka/demo.producer.ts** (produce)

```ts
import { Injectable } from "@nestjs/common";
import {
  KafkaService,
  EscrowTopics,
  EscrowCreatedPayload,
  EscrowSnapshot,
} from "@escrowly/kafka-core";

@Injectable()
export class DemoProducer {
  constructor(private readonly kafka: KafkaService) {}

  async sendCreated(escrow: EscrowSnapshot, userId: string) {
    const payload: EscrowCreatedPayload = { escrow, initiatedBy: userId };
    await this.kafka.produce(EscrowTopics.CREATED, payload, escrow.id);
  }
}
```

**kafka/demo.consumer.ts** (consume)

```ts
import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import {
  KafkaService,
  EscrowTopics,
  BaseEvent,
  PaymentCompletedPayload,
} from "@escrowly/kafka-core";

@Injectable()
export class DemoConsumer implements OnModuleInit {
  private readonly logger = new Logger(DemoConsumer.name);

  constructor(private readonly kafka: KafkaService) {}

  async onModuleInit() {
    this.kafka.subscribe<PaymentCompletedPayload>(
      EscrowTopics.PAYMENT_COMPLETED,
      async (event) => {
        await this.handlePayment(event);
      }
    );
    await this.kafka.startConsuming();
  }

  private async handlePayment(event: BaseEvent<PaymentCompletedPayload>) {
    this.logger.log(`Payment completed for escrow ${event.payload.escrowId}`);
  }
}
```

**Usage in any service**

```ts
await demoProducer.sendCreated(escrowSnapshot, userId);
```

## Adding a new topic (producer + consumer workflow)

1. **Define the topic and payload type**
   - Add to `packages/kafka-core/src/constants/topics.enum.ts` (e.g., `NEW_FEATURE = 'new.feature'`).
   - Add a payload interface in `packages/kafka-core/src/schemas/event.schema.ts` (e.g., `export interface NewFeaturePayload { ... }`).
   - Export both from `packages/kafka-core/src/index.ts` (already re-exported if you add to the existing exports).

2. **Use in a producer (any service)**

   ```ts
   await kafkaService.produce(
     NewFeatureTopics.NEW_FEATURE,
     payload,
     partitionKey,
     correlationId
   );
   ```

3. **Consume in another service**

   ```ts
   kafkaService.subscribe<NewFeaturePayload>(
     NewFeatureTopics.NEW_FEATURE,
     async (event) => {
       // handle event.payload
     }
   );
   await kafkaService.startConsuming();
   ```

4. **Contracts stay centralized**
   - Topics and payload interfaces live in `@escrowly/kafka-core`, so producers and consumers share the same definitions.
   - Keep payloads backward compatible; add fields instead of removing/renaming when possible.
   - Central files to change:
     - Topics: `packages/kafka-core/src/constants/topics.enum.ts`
     - Payloads + type maps: `packages/kafka-core/src/schemas/event.schema.ts`
     - Re-exports (already aggregated): `packages/kafka-core/src/index.ts`

### Step 3: Register Provider

```typescript
// your.module.ts
import { Module } from "@nestjs/common";
import { YourEventProducer } from "./kafka/produce-events";

@Module({
  providers: [YourEventProducer],
})
export class YourModule {}
```

### Step 4: Use in Service

```typescript
// your.service.ts
@Injectable()
export class YourService {
  constructor(private readonly eventProducer: YourEventProducer) {}

  async createSomething() {
    // ... business logic ...

    // Fire event (non-blocking)
    await this.eventProducer.onEscrowCreated(escrow, userId);
  }
}
```

## Production Patterns

### Pattern 1: Fire-and-Forget (Recommended for Most Cases)

**Use when:** You don't need a response, event is a side effect (notifications, audit logs, analytics).

**How it works:**

- Event is saved to outbox in same DB transaction
- Outbox publisher processes events asynchronously
- If Kafka is down, events are retried automatically
- No blocking of business logic

```typescript
// kafka/produce-events.ts
import { Injectable, Logger } from "@nestjs/common";
import {
  KafkaService,
  EscrowTopics,
  EscrowCreatedPayload,
  EscrowSnapshot,
} from "@escrowly/kafka-core";
import { OutboxRepository } from "../repository/outbox.repository";

@Injectable()
export class EscrowEventProducer {
  private readonly logger = new Logger(EscrowEventProducer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly outboxRepository: OutboxRepository
  ) {}

  async escrowCreated(escrow: EscrowSnapshot, userId: string): Promise<void> {
    const payload: EscrowCreatedPayload = { escrow, initiatedBy: userId };

    try {
      // Try to publish directly
      await this.kafka.produce(EscrowTopics.CREATED, payload, escrow.id);
      this.logger.debug(`Published escrow.created for ${escrow.id}`);
    } catch (error: any) {
      // If Kafka fails, save to outbox (non-blocking)
      this.logger.error(
        `Failed to produce ${EscrowTopics.CREATED}: ${error.message}`
      );
      await this.outboxRepository.save(
        EscrowTopics.CREATED,
        escrow.id,
        payload,
        error?.message,
        "failed"
      );
      // Don't throw - business logic continues
    }
  }
}
```

**Setup Outbox Publisher** (in your module):

```typescript
// app.module.ts or escrow.module.ts
import { OutboxPublisherService } from "./kafka/outbox-publisher.service";

@Module({
  providers: [
    EscrowEventProducer,
    OutboxPublisherService, // Handles retries automatically
  ],
})
export class EscrowModule {}
```

**Benefits:**

- ✅ Non-blocking (business logic doesn't wait)
- ✅ Automatic retries (outbox publisher handles failures)
- ✅ No data loss (events saved to DB)
- ✅ Works even when Kafka is down

---

### Pattern 2: Request/Reply (Hard-Sync)

**Use when:** You need a response before proceeding (balance checks, validations, synchronous operations).

**How it works:**

- Send request to Kafka topic
- Wait for reply on reply topic
- Timeout if no reply received
- Returns response or throws error

```typescript
// Setup Request/Reply Service
import { KafkaRequestReplyService, RequestReplyConfig } from '@escrowly/kafka-core';

// In your module
{
  provide: KafkaRequestReplyService,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const brokers = config.get('KAFKA_BROKERS', 'localhost:9092').split(',');
    const rrConfig: RequestReplyConfig = {
      clientId: 'escrow-service-rr',
      brokers: brokers.map(b => b.trim()),
      replyTopic: 'escrow-service.replies',
      timeoutMs: 10_000, // 10 second timeout
    };
    return new KafkaRequestReplyService(rrConfig);
  },
}

// Usage in Service
@Injectable()
export class EscrowService {
  constructor(
    private readonly requestReply: KafkaRequestReplyService,
  ) {}

  async createEscrow(dto: CreateEscrowDto, userId: string) {
    // Check balance before creating escrow
    try {
      const reply = await this.requestReply.request<BalanceCheckRequest, BalanceCheckReply>(
        'ledger.balance.check',
        { walletId: dto.buyerId, amount: dto.amount },
        dto.buyerId, // partition key
        10_000, // timeout
      );

      if (reply.payload.status === 'insufficient') {
        throw new BadRequestException('Insufficient balance');
      }

      // Proceed with escrow creation
      return this.escrowRepository.create(dto, userId);
    } catch (error) {
      if (error.message.includes('timeout')) {
        throw new ServiceUnavailableException('Ledger service unavailable');
      }
      throw error;
    }
  }
}
```

**Reply Handler** (in Ledger Service):

```typescript
// ledger.service.ts
@Injectable()
export class LedgerConsumer implements OnModuleInit {
  constructor(
    private readonly kafka: KafkaService,
    private readonly requestReply: KafkaRequestReplyService
  ) {}

  async onModuleInit() {
    this.kafka.subscribe<BalanceCheckRequest>(
      "ledger.balance.check",
      async (event, raw) => {
        const correlationId = raw.message.headers?.correlationId?.toString();
        const replyTo = raw.message.headers?.replyTo?.toString();

        if (!correlationId || !replyTo) return;

        // Check balance
        const balance = await this.getBalance(event.payload.walletId);
        const reply: BalanceCheckReply = {
          status:
            balance >= event.payload.amount ? "sufficient" : "insufficient",
          available: balance,
        };

        // Send reply
        await this.requestReply.reply(
          replyTo,
          correlationId,
          reply,
          event.metadata.eventId
        );
      }
    );

    await this.kafka.startConsuming();
  }
}
```

**Benefits:**

- ✅ Synchronous response (like HTTP but over Kafka)
- ✅ No HTTP dependencies between services
- ✅ Works with Kafka infrastructure
- ⚠️ Timeout handling required

---

## Consuming Events (With Reliability)

### Pattern 3: Consumer with Idempotency + Retry + DLQ

**Use when:** You need reliable event processing with duplicate prevention and error handling.

**How it works:**

- Checks if event already processed (idempotency)
- Retries transient failures (3x with exponential backoff)
- Sends permanent failures to DLQ
- Marks business errors as `business_failed` (no retry)

```typescript
// Setup Consumer Wrapper
import {
  KafkaConsumerWrapperService,
  ConsumerWrapperConfig,
} from '@escrowly/kafka-core';

// In your module
{
  provide: KafkaConsumerWrapperService,
  useFactory: (kafka: KafkaService) => {
    return new KafkaConsumerWrapperService(kafka, {
      maxRetries: 3,
      retryDelayMs: 1000,
      dlqTopicSuffix: '.dlq',
      enableIdempotency: true,
    });
  },
  inject: [KafkaService],
}

// Create processed_events table (Prisma schema)
model ProcessedEvent {
  id        String   @id @default(uuid())
  eventId   String
  topic     String
  status    String   // 'processed' | 'failed' | 'business_failed'
  error     String?
  processedAt DateTime @default(now())

  @@unique([eventId, topic])
  @@index([topic, status])
  @@map("processed_events")
}

// Usage in Consumer Service
@Injectable()
export class NotificationConsumer implements OnModuleInit {
  constructor(
    private readonly wrapper: KafkaConsumerWrapperService,
    private readonly kafka: KafkaService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.wrapper.subscribe<EscrowCreatedPayload>(
      EscrowTopics.CREATED,
      // Handler function
      async (event) => {
        await this.sendNotification(event.payload.escrow.buyerId);
      },
      // Idempotency check
      async (eventId, topic) => {
        const exists = await this.prisma.processedEvent.findUnique({
          where: { eventId_topic: { eventId, topic } },
        });
        return !!exists;
      },
      // Mark processed
      async (eventId, topic, status, error) => {
        await this.prisma.processedEvent.upsert({
          where: { eventId_topic: { eventId, topic } },
          create: {
            eventId,
            topic,
            status,
            error,
            processedAt: new Date(),
          },
          update: { status, error },
        });
      },
      // Send to DLQ
      async (topic, event, error, retryCount) => {
        await this.kafka.produce(
          `${topic}.dlq`,
          {
            originalEvent: event,
            error,
            retryCount,
            failedAt: new Date().toISOString(),
            service: 'notification-service',
          },
          event.metadata.eventId,
        );
      },
      // Error classifier (optional)
      (error) => {
        // Business errors (don't retry)
        if (error instanceof InsufficientBalanceError) {
          return 'BUSINESS';
        }
        // Transient errors (retry)
        if (error.message.includes('timeout') || error.message.includes('connection')) {
          return 'TRANSIENT';
        }
        return 'UNKNOWN';
      },
    );

    await this.kafka.startConsuming();
  }

  private async sendNotification(userId: string) {
    // Your notification logic
  }
}
```

**Error Classification:**

- `BUSINESS`: Permanent business logic errors (insufficient balance, invalid state) → No retry, marked as `business_failed`
- `TRANSIENT`: Infrastructure errors (timeout, connection) → Retry 3x, then DLQ
- `UNKNOWN`: Unknown errors → Retry 3x, then DLQ

**Benefits:**

- ✅ Idempotency (no duplicate processing)
- ✅ Automatic retries (transient failures)
- ✅ DLQ for investigation (permanent failures)
- ✅ Business error handling (no unnecessary retries)

---

## Complete Example: All Patterns Together

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KafkaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: "escrow-service",
        groupId: "escrow-consumer-group",
        brokers: config.get("KAFKA_BROKERS", "localhost:9092"),
        enabled: config.get("KAFKA_ENABLED", "false") === "true",
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Fire-and-forget producer
    EscrowEventProducer,
    OutboxPublisherService,

    // Request/reply
    {
      provide: KafkaRequestReplyService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const brokers = config
          .get("KAFKA_BROKERS", "localhost:9092")
          .split(",");
        return new KafkaRequestReplyService({
          clientId: "escrow-service-rr",
          brokers: brokers.map((b) => b.trim()),
          replyTopic: "escrow-service.replies",
          timeoutMs: 10_000,
        });
      },
    },

    // Consumer wrapper
    {
      provide: KafkaConsumerWrapperService,
      useFactory: (kafka: KafkaService) => {
        return new KafkaConsumerWrapperService(kafka, {
          maxRetries: 3,
          retryDelayMs: 1000,
          dlqTopicSuffix: ".dlq",
        });
      },
      inject: [KafkaService],
    },
  ],
})
export class AppModule {}
```

---

## Error Handling Guide

### Infrastructure Errors (Kafka Down, Network Issues)

- **Fire-and-forget**: Saved to outbox → Retried by publisher → Published when Kafka recovers
- **Request/reply**: Timeout after configured time → Return error to caller
- **Consumer**: Retry 3x → Send to DLQ if still failing

### Database Errors

- **Outbox save**: Logged, event may be lost (rare)
- **Outbox publish**: Event already in Kafka → Partial success (event published, DB update failed)
- **Consumer**: Retry 3x → Send to DLQ

### Business Logic Errors (Insufficient Balance, Invalid State)

- **Fire-and-forget**: Event still published (it's a fact that happened)
- **Request/reply**: Reply with error → No retry (business logic error)
- **Consumer**: Mark as `business_failed` → No retry, no DLQ (use error classifier)

---

## Pattern Selection Guide

| Scenario                      | Pattern                | Example                           |
| ----------------------------- | ---------------------- | --------------------------------- |
| User action → Notify user     | Fire-and-forget        | Escrow created → Send email       |
| User action → Need validation | Request/reply          | Create escrow → Check balance     |
| Event → Process async         | Consumer wrapper       | Payment completed → Reserve funds |
| Event → Critical processing   | Consumer wrapper + DLQ | Escrow completed → Release funds  |

---

## Monitoring & Debugging

### Check Outbox Status

```sql
SELECT topic, status, retry_count, last_error, created_at, published_at
FROM outbox_events
WHERE status IN ('pending', 'failed')
ORDER BY created_at DESC;
```

### Check Processed Events

```sql
SELECT event_id, topic, status, error, processed_at
FROM processed_events
WHERE status = 'failed'
ORDER BY processed_at DESC;
```

### Check DLQ Topics

- View in Kafka UI: `http://localhost:8080`
- Look for topics ending in `.dlq`
- Investigate failed events with error details

## Available Topics

### Escrow Topics

```typescript
import { EscrowTopics } from "@escrowly/kafka-core";

EscrowTopics.CREATED; // 'escrow.created'
EscrowTopics.ACCEPTED; // 'escrow.accepted'
EscrowTopics.PAYMENT_COMPLETED; // 'escrow.payment.completed'
EscrowTopics.DELIVERY_STARTED; // 'escrow.delivery.started'
EscrowTopics.INSPECTION_COMPLETED; // 'escrow.inspection.completed'
EscrowTopics.COMPLETED; // 'escrow.completed'
EscrowTopics.REFUNDED; // 'escrow.refunded'
EscrowTopics.CANCELLED; // 'escrow.cancelled'
EscrowTopics.DISPUTED; // 'escrow.disputed'
EscrowTopics.RESOLVED; // 'escrow.resolved'
EscrowTopics.FORCE_CLOSED; // 'escrow.force.closed'
```

### Auth Topics

```typescript
import { AuthTopics } from "@escrowly/kafka-core";

AuthTopics.USER_CREATED; // 'auth.user.created'
AuthTopics.USER_UPDATED; // 'auth.user.updated'
AuthTopics.SESSION_CREATED; // 'auth.session.created'
AuthTopics.KYC_APPROVED; // 'auth.kyc.approved'
// ... more
```

### Ledger Topics

```typescript
import { LedgerTopics } from "@escrowly/kafka-core";

LedgerTopics.BALANCE_RESERVED; // 'ledger.balance.reserved'
LedgerTopics.BALANCE_RELEASED; // 'ledger.balance.released'
LedgerTopics.TRANSACTION_CONFIRMED; // 'ledger.transaction.confirmed'
// ... more
```

## Event Structure

All events follow this structure:

```typescript
interface BaseEvent<T> {
  metadata: {
    eventId: string; // UUID v4 (use for idempotency)
    timestamp: string; // ISO-8601
    eventType: string; // Topic name
    source: string; // Producer service name
    version: string; // Schema version
    correlationId?: string; // For distributed tracing
  };
  payload: T; // Your typed payload
}
```

## Event Payloads

All payloads are fully typed:

```typescript
import {
  // Escrow payloads
  EscrowCreatedPayload,
  EscrowAcceptedPayload,
  PaymentCompletedPayload,
  DeliveryStartedPayload,
  InspectionCompletedPayload,
  EscrowCompletedPayload,
  EscrowCancelledPayload,
  DisputeOpenedPayload,
  DisputeResolvedPayload,
  ForceClosedPayload,

  // Auth payloads
  UserCreatedPayload,
  SessionCreatedPayload,

  // Ledger payloads
  BalanceReservedPayload,
  BalanceReleasedPayload,
} from "@escrowly/kafka-core";
```

## Schema Validation

```typescript
import { SchemaValidator } from "@escrowly/kafka-core";

// Validate full event
const isValid = SchemaValidator.validateEvent(event);

// Parse and validate JSON
const event = SchemaValidator.parseEvent<PaymentCompletedPayload>(jsonString);
if (!event) {
  console.error("Invalid event");
}

// Validate by event type
SchemaValidator.validateByType("escrow.created", payload);
```

## Configuration

### Environment Variables

```env
# Enable/disable Kafka (default: false)
KAFKA_ENABLED=true

# Kafka broker addresses (comma-separated for clusters)
KAFKA_BROKERS=localhost:9092

# For production with SASL auth:
KAFKA_BROKERS=broker1:9092,broker2:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-512
KAFKA_SASL_USERNAME=your-username
KAFKA_SASL_PASSWORD=your-password
```

### With SASL Authentication

```typescript
KafkaModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    clientId: "your-service",
    groupId: "your-consumer-group",
    brokers: config.get("KAFKA_BROKERS"),
    enabled: config.get("KAFKA_ENABLED") === "true",
    ssl: config.get("KAFKA_SSL") === "true",
    sasl: {
      mechanism: config.get("KAFKA_SASL_MECHANISM", "scram-sha-512"),
      username: config.get("KAFKA_SASL_USERNAME"),
      password: config.get("KAFKA_SASL_PASSWORD"),
    },
  }),
  inject: [ConfigService],
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    @escrowly/kafka-core                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │   module/    │   │  services/   │   │    constants/    │    │
│  │              │   │              │   │                  │    │
│  │ KafkaModule  │──▶│ KafkaService │──▶│  EscrowTopics    │    │
│  │ forRoot()    │   │ produce()    │   │  AuthTopics      │    │
│  │ forRootAsync │   │ subscribe()  │   │  LedgerTopics    │    │
│  └──────────────┘   └──────┬───────┘   └──────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│                     ┌──────────────┐                           │
│                     │   schemas/   │                           │
│                     │              │                           │
│                     │ BaseEvent    │                           │
│                     │ Payloads     │                           │
│                     │ Validator    │                           │
│                     └──────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    KAFKA     │
                     │   BROKER     │
                     └──────────────┘
```

## Folder Breakdown

| Folder         | Purpose            | Key Files                                                    |
| -------------- | ------------------ | ------------------------------------------------------------ |
| **module/**    | NestJS integration | `kafka.module.ts`                                            |
| **services/**  | Core Kafka logic   | `kafka.service.ts`, `kafka.producer.ts`, `kafka.consumer.ts` |
| **constants/** | Topic definitions  | `topics.enum.ts`                                             |
| **schemas/**   | Types & validation | `event.schema.ts`, `schema-validator.ts`                     |

## Best Practices

### 1. Use Partition Keys for Ordering

```typescript
// All events for same escrow go to same partition = ordered
await this.kafka.produce(topic, payload, escrowId);
```

### 2. Implement Idempotency in Consumers

```typescript
async handleEvent(event: BaseEvent<T>) {
  // Check if already processed
  const exists = await this.db.findProcessedEvent(event.metadata.eventId);
  if (exists) return;

  // Process event
  await this.processEvent(event);

  // Mark as processed
  await this.db.markEventProcessed(event.metadata.eventId);
}
```

### 3. Don't Block Business Logic

```typescript
// ✅ Good - fire and forget
await this.eventProducer.escrowCreated(escrow, userId);
return escrow;

// ❌ Bad - waiting for acknowledgment
try {
  await this.eventProducer.escrowCreated(escrow, userId);
} catch (error) {
  throw new Error("Event failed"); // Don't do this
}
```

### 4. Use Correlation IDs for Tracing

```typescript
await this.kafka.produce(
  topic,
  payload,
  partitionKey,
  correlationId // Pass through from request
);
```

## Downstream Service Matrix

| Event                      | Ledger                 | Notifications | Admin | Analytics |
| -------------------------- | ---------------------- | ------------- | ----- | --------- |
| `escrow.created`           | -                      | ✅            | -     | ✅        |
| `escrow.payment.completed` | ✅ `reserve_funds`     | ✅            | -     | ✅        |
| `escrow.completed`         | ✅ `release_to_seller` | ✅            | -     | ✅        |
| `escrow.disputed`          | ✅ `freeze_funds`      | ✅            | ✅    | ✅        |
| `escrow.resolved`          | ✅ varies              | ✅            | ✅    | ✅        |
| `auth.user.created`        | ✅ create wallet       | ✅            | -     | ✅        |

## Testing

### Mock KafkaService

```typescript
const mockKafkaService = {
  produce: jest.fn().mockResolvedValue("event-id"),
  subscribe: jest.fn(),
  startConsuming: jest.fn(),
  isEnabled: true,
};

const module = await Test.createTestingModule({
  providers: [
    YourService,
    { provide: KafkaService, useValue: mockKafkaService },
  ],
}).compile();
```

### Disable in Tests

```env
# test.env
KAFKA_ENABLED=false
```

## Troubleshooting

### Events Not Producing

1. Check `KAFKA_ENABLED=true`
2. Check `KAFKA_BROKERS` is correct
3. Check broker connectivity
4. Check logs for errors

### Consumer Not Receiving

1. Verify topic exists
2. Check consumer group ID
3. Verify `startConsuming()` is called
4. Check offset settings

### Type Errors

```typescript
// ✅ Import from single entry point
import { KafkaService, EscrowTopics } from "@escrowly/kafka-core";

// ❌ Don't import from subfolders
import { KafkaService } from "@escrowly/kafka-core/services";
```

## Migration from Old Structure

If you're migrating from the flat structure:

```typescript
// Old (flat structure)
import { KafkaService } from "@escrowly/kafka-core/kafka.service";
import { EscrowTopics } from "@escrowly/kafka-core/topics.enum";

// New (organized structure) - imports work the same!
import { KafkaService, EscrowTopics } from "@escrowly/kafka-core";
```

**No code changes needed** - the package exports remain the same!

## Contributing

When adding new topics or payloads:

1. **Add topic** to `src/constants/topics.enum.ts`
2. **Add payload** to `src/schemas/event.schema.ts`
3. **Rebuild** with `npm run build`
4. **Update** downstream services

## License

MIT
