# Why Each Service Needs Its Own OutboxAdapter

## Quick Answer

Each service needs its own `OutboxAdapter` because:
1. **Different Databases** - Each service has its own database connection
2. **Different Table Schemas** - Tables have different names, columns, and structures
3. **Different PrismaService Instances** - Each service's PrismaService connects to its own DB
4. **Transaction Boundaries** - Adapter must work within service's own transaction context
5. **Service Autonomy** - Each service can customize its implementation

---

## 1. Different Database Connections

### Problem Without Adapter

If `kafka-publisher` tried to access databases directly:

```typescript
// ❌ This won't work - which database?
class OutboxProcessorService {
  async findPendingEvents() {
    // Which PrismaService? Escrow's? Ledger's? Both?
    // How do we know which database to query?
    return await ???.outboxEvent.findMany({ ... });
  }
}
```

### Solution With Adapter

Each service provides its own adapter that knows its database:

```typescript
// ✅ Escrow Service
@Injectable()
export class PrismaOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}
  // ↑ This PrismaService connects to escrow_db
  
  async findPendingEvents(limit: number) {
    return await this.prisma.$queryRaw`
      SELECT * FROM outbox_events  -- Escrow's table
    `;
  }
}

// ✅ Ledger Service  
@Injectable()
export class LedgerOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}
  // ↑ This PrismaService connects to ledger_db
  
  async findPendingEvents(limit: number) {
    return await this.prisma.$queryRaw`
      SELECT * FROM ledger_outbox  -- Ledger's table
    `;
  }
}
```

**Key Point**: Each service's `PrismaService` is configured with its own `DATABASE_URL` pointing to its own database.

---

## 2. Different Table Schemas

### Escrow Service Schema

```prisma
// services/escrow/prisma/schema.prisma
model OutboxEvent {
    id           String    @id @default(uuid())
    topic        String                    // ← Different column name
    partitionKey String                    // ← Different column name
    payload      String    @db.Text        // ← String type
    status       String    @default("pending")
    retryCount   Int       @default(0)    // ← Different column name
    lastError    String?   @db.Text
    createdAt    DateTime  @default(now())
    publishedAt  DateTime?                 // ← Has this column
    nextRetryAt  DateTime?                 // ← Has this column
    
    @@map("outbox_events")                // ← Different table name
    @@schema("escrow_db")                  // ← Different schema
}
```

### Ledger Service Schema

```prisma
// services/ledger/prisma/schema.prisma
model LedgerOutbox {
    id        String   @id @default(uuid())
    eventType String                    // ← Different column name
    eventKey  String                    // ← Different column name
    payload   Json                      // ← JSON type (not String)
    status    String   @default("pending")
    attempts  Int      @default(0)     // ← Different column name
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt       // ← Has this column (no publishedAt/nextRetryAt)
    
    @@map("ledger_outbox")              // ← Different table name
    @@schema("ledger_db")               // ← Different schema
}
```

### Adapter Handles Schema Differences

```typescript
// Escrow Adapter - maps escrow_db.outbox_events to OutboxEvent interface
async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
  const events = await this.prisma.$queryRaw`
    SELECT 
      id,
      topic,                    -- ← Escrow has 'topic'
      "partitionKey",           -- ← Escrow has 'partitionKey'
      payload,
      status,
      "retryCount",             -- ← Escrow has 'retryCount'
      "nextRetryAt",            -- ← Escrow has 'nextRetryAt'
      "publishedAt"             -- ← Escrow has 'publishedAt'
    FROM outbox_events          -- ← Escrow's table name
    WHERE status = 'pending'
  `;
  return events.map(/* map to OutboxEvent */);
}

// Ledger Adapter - maps ledger_db.ledger_outbox to OutboxEvent interface
async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
  const events = await this.prisma.ledgerOutbox.findMany({
    where: { status: 'pending' },
    take: limit,
  });
  
  // Map Ledger's schema to OutboxEvent interface
  return events.map(event => ({
    id: event.id,
    topic: event.eventType,              // ← Map eventType → topic
    partitionKey: event.eventKey,       // ← Map eventKey → partitionKey
    payload: JSON.stringify(event.payload), // ← Convert Json → String
    status: event.status,
    retryCount: event.attempts,          // ← Map attempts → retryCount
    nextRetryAt: undefined,             // ← Ledger doesn't have this
    publishedAt: undefined,             // ← Ledger doesn't have this
    createdAt: event.createdAt,
  }));
}
```

**Key Point**: The adapter translates between service-specific schemas and the common `OutboxEvent` interface.

---

## 3. Different PrismaService Instances

### How PrismaService is Configured

```typescript
// services/escrow/src/common/database/database.module.ts
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (secretsService: SecretsService) => {
        const dbUrl = await secretsService.getDatabaseUrl();
        // ↑ Gets escrow_db connection string
        process.env.DATABASE_URL = dbUrl;
        return new PrismaService(secretsService);
        // ↑ PrismaService connects to escrow_db
      },
      inject: [SecretsService],
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

```typescript
// services/ledger/src/common/database/database.module.ts
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (secretsService: SecretsService) => {
        const dbUrl = await secretsService.getDatabaseUrl();
        // ↑ Gets ledger_db connection string
        process.env.DATABASE_URL = dbUrl;
        return new PrismaService(secretsService);
        // ↑ PrismaService connects to ledger_db
      },
      inject: [SecretsService],
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

### Adapter Uses Service's PrismaService

```typescript
// Escrow's adapter gets Escrow's PrismaService
@Injectable()
export class PrismaOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}
  // ↑ Injected PrismaService connects to escrow_db
  //   It knows about escrow_db.outbox_events table
}

// Ledger's adapter gets Ledger's PrismaService  
@Injectable()
export class LedgerOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}
  // ↑ Injected PrismaService connects to ledger_db
  //   It knows about ledger_db.ledger_outbox table
}
```

**Key Point**: Dependency injection ensures each adapter gets the correct `PrismaService` for its service's database.

---

## 4. Transaction Boundaries

### Transactional Outbox Pattern Requires Same Database

```typescript
// In Escrow Service business logic
await prisma.$transaction(async (tx) => {
  // 1. Update business data
  await tx.escrow.update({ ... });
  
  // 2. Write to outbox (SAME transaction!)
  await tx.outboxEvent.create({
    topic: 'escrow.created',
    payload: JSON.stringify(event),
  });
  
  // Both succeed or both fail - atomic!
});
```

The adapter must be able to work within this transaction:

```typescript
// Escrow Adapter can use the same PrismaService instance
async findPendingEvents(limit: number) {
  // Uses escrow_db connection
  return await this.prisma.$queryRaw`
    SELECT * FROM outbox_events  -- Same DB as business data
  `;
}
```

If we tried to use a shared adapter, transactions wouldn't work:

```typescript
// ❌ This breaks transactional guarantees
await escrowPrisma.$transaction(async (tx) => {
  await tx.escrow.update({ ... });
  await sharedAdapter.createOutboxEvent(...);  // Different DB!
  // ↑ Transaction can't span multiple databases!
});
```

**Key Point**: The adapter must query the same database where business data is stored to maintain transactional guarantees.

---

## 5. Service Autonomy & Customization

### Each Service Can Customize

```typescript
// Escrow Service - Uses raw SQL for performance
export class PrismaOutboxAdapter implements OutboxAdapter {
  async findPendingEvents(limit: number) {
    return await this.prisma.$queryRaw`
      SELECT * FROM outbox_events
      WHERE status = 'pending'
      FOR UPDATE SKIP LOCKED  -- ← Custom locking strategy
      LIMIT ${limit}
    `;
  }
}

// Ledger Service - Uses Prisma ORM
export class LedgerOutboxAdapter implements OutboxAdapter {
  async findPendingEvents(limit: number) {
    return await this.prisma.ledgerOutbox.findMany({
      where: { status: 'pending' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }
}

// Future Service - Could use TypeORM or Sequelize
export class PaymentOutboxAdapter implements OutboxAdapter {
  async findPendingEvents(limit: number) {
    return await this.typeOrmRepository.find({
      where: { status: 'pending' },
      take: limit,
    });
  }
}
```

**Key Point**: Each service can choose its own database access pattern while implementing the same interface.

---

## What If We Used a Single Shared Adapter?

### ❌ Problems with Shared Adapter

```typescript
// Hypothetical shared adapter (NOT how it works)
class SharedOutboxAdapter implements OutboxAdapter {
  constructor(
    private escrowPrisma: PrismaService,
    private ledgerPrisma: PrismaService,
    private adminPrisma: PrismaService,
  ) {}
  
  async findPendingEvents(limit: number) {
    // Which database to query?
    // How to distribute the limit across services?
    // What if services have different schemas?
    // How to handle transactions?
    
    const escrowEvents = await this.escrowPrisma.outboxEvent.findMany(...);
    const ledgerEvents = await this.ledgerPrisma.ledgerOutbox.findMany(...);
    // ... merge results? Order by what?
    
    return [...escrowEvents, ...ledgerEvents].slice(0, limit);
  }
}
```

**Problems:**
1. ❌ **Cross-service dependencies** - Adapter needs access to all service databases
2. ❌ **No transaction guarantees** - Can't ensure outbox write is in same transaction as business data
3. ❌ **Schema complexity** - Must handle all different schemas in one place
4. ❌ **Scaling issues** - All services depend on shared adapter updates
5. ❌ **Deployment coupling** - Changes to one service affect others

---

## ✅ Benefits of Per-Service Adapters

### 1. **Service Isolation**
- Each service owns its adapter implementation
- Changes to one service don't affect others
- Services can evolve independently

### 2. **Database Isolation**
- Each service queries only its own database
- No shared database connections
- Better security boundaries

### 3. **Transactional Guarantees**
- Outbox writes happen in same transaction as business data
- Atomic operations within service boundaries
- No distributed transaction complexity

### 4. **Schema Flexibility**
- Each service can design its outbox table as needed
- Adapter handles mapping to common interface
- Easy to add service-specific fields

### 5. **Independent Scaling**
- Each service scales its database independently
- No shared bottlenecks
- Better performance isolation

### 6. **Technology Flexibility**
- Services can use different ORMs (Prisma, TypeORM, Sequelize)
- Services can use different databases (PostgreSQL, MySQL, etc.)
- Adapter abstracts the differences

---

## Real-World Example: Adding a New Service

### Step 1: Create Service-Specific Adapter

```typescript
// services/payment/src/kafka/payment-outbox.adapter.ts
@Injectable()
export class PaymentOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}
  // ↑ Payment service's PrismaService (connects to payment_db)
  
  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    // Query payment service's own database
    const events = await this.prisma.$queryRaw`
      SELECT * FROM payment_outbox  -- Payment's own table
      WHERE status = 'pending'
      LIMIT ${limit}
    `;
    
    // Map to OutboxEvent interface
    return events.map(event => ({
      id: event.id,
      topic: event.event_type,        // Payment uses snake_case
      partitionKey: event.payment_id,
      payload: event.event_data,
      status: event.status,
      retryCount: event.retries,
      createdAt: event.created_at,
      // ... map other fields
    }));
  }
  
  async markPublished(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE payment_outbox
      SET status = 'published', published_at = NOW()
      WHERE id = ${id}
    `;
  }
  
  // ... implement other methods
}
```

### Step 2: Register in Service Module

```typescript
// services/payment/src/app.module.ts
@Module({
  imports: [
    DatabaseModule,  // Provides PrismaService for payment_db
    
    KafkaPublisherModule.forRoot({
      adapter: PaymentOutboxAdapter,  // ← Payment's adapter
      config: {
        pollingIntervalMs: 2000,
        batchSize: 20,
      },
    }),
  ],
})
export class AppModule {}
```

### Step 3: That's It!

The `kafka-publisher` package:
- ✅ Doesn't need to know about `payment_outbox` table
- ✅ Doesn't need to know about payment_db schema
- ✅ Doesn't need payment service's database credentials
- ✅ Just uses the `OutboxAdapter` interface

---

## Summary

| Aspect | Without Per-Service Adapters | With Per-Service Adapters |
|--------|------------------------------|---------------------------|
| **Database Access** | Shared adapter needs all DBs | Each adapter uses its own DB |
| **Schema Differences** | Must handle all schemas | Each adapter handles its own |
| **Transactions** | Can't guarantee atomicity | Same DB = atomic transactions |
| **Service Changes** | Affects all services | Isolated to one service |
| **Deployment** | Coupled deployments | Independent deployments |
| **Scaling** | Shared bottlenecks | Independent scaling |
| **Technology** | Locked to one ORM/DB | Flexible per service |

**The adapter pattern provides the abstraction needed to keep `kafka-publisher` generic while allowing each service to work with its own database structure.**

