# Inquiry Service

> A production-ready NestJS microservice for managing customer support inquiries in the Escrowly platform.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Diagram](#architecture-diagram)
- [File and Folder Structure](#file-and-folder-structure)
- [Kafka Integration](#kafka-integration)
  - [What is Kafka?](#what-is-kafka)
  - [Kafka Core Module](#kafka-core-module)
  - [Kafka Publisher & Outbox Pattern](#kafka-publisher--outbox-pattern)
- [Service Workflows](#service-workflows)
- [Classes Explanation](#classes-explanation)
- [Database & Prisma Schema](#database--prisma-schema)
- [API Endpoints](#api-endpoints)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [Tips for Understanding the Code](#tips-for-understanding-the-code)

---

## Project Overview

### What is the Inquiry Service?
\
The **Inquiry Service** is a microservice responsible for managing customer support tickets (inquiries) in the Escrowly platform. When users have questions, disputes, or issues with their escrow transactions, they can create an inquiry to communicate with support staff.

### Purpose

- **Create and manage support inquiries** linked to escrow transactions
- **Message handling** - threaded conversations between buyers, sellers, and admins
- **Attachment management** - file uploads for evidence/documentation
- **Admin operations** - assign inquiries to admins, resolve disputes
- **Event-driven architecture** - publish events to Kafka for other services to consume

### How it Fits in the System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ESCROWLY PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────┐ │
│  │ Auth Service │   │Escrow Service│   │      Inquiry Service         │ │
│  │  (port 3000) │   │  (port 3004) │   │       (port 3003)            │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────────┬───────────────┘ │
│         │                  │                          │                  │
│         │                  │    Kafka Events          │                  │
│         └──────────────────┼──────────────────────────┤                  │
│                            │                          │                  │
│                     ┌──────▼──────────────────────────▼──────┐          │
│                     │            KAFKA BROKER                 │          │
│                     │  (Redpanda / Apache Kafka)              │          │
│                     └─────────────────────────────────────────┘          │
│                                                                          │
│                     ┌─────────────────────────────────────────┐          │
│                     │         PostgreSQL Database              │          │
│                     │  ┌─────────┐ ┌─────────┐ ┌───────────┐  │          │
│                     │  │ auth_db │ │escrow_db│ │ inquiry_db│  │          │
│                     │  └─────────┘ └─────────┘ └───────────┘  │          │
│                     └─────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INQUIRY SERVICE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                       HTTP LAYER (REST API)                         ││
│  │                                                                     ││
│  │  ┌─────────────────────┐   ┌─────────────────────────────────────┐ ││
│  │  │  InquiryController  │   │       HealthController              │ ││
│  │  │  /api/v1/inquiries  │   │       /api/v1/health                │ ││
│  │  └──────────┬──────────┘   └─────────────────────────────────────┘ ││
│  └─────────────┼───────────────────────────────────────────────────────┘│
│                │                                                         │
│  ┌─────────────▼───────────────────────────────────────────────────────┐│
│  │                       SERVICE LAYER                                  ││
│  │                                                                     ││
│  │  ┌─────────────────────┐   ┌─────────────────────────────────────┐ ││
│  │  │   InquiryService    │   │     InquiryConsumerService          │ ││
│  │  │  (Business Logic)   │   │   (Kafka Event Consumer)            │ ││
│  │  └──────────┬──────────┘   └──────────┬──────────────────────────┘ ││
│  └─────────────┼────────────────────────┼──────────────────────────────┘│
│                │                        │                                │
│  ┌─────────────▼────────────────────────▼──────────────────────────────┐│
│  │                       KAFKA LAYER                                    ││
│  │                                                                     ││
│  │  ┌─────────────────────┐   ┌─────────────────────────────────────┐ ││
│  │  │InquiryEventProducer │   │      PrismaOutboxAdapter            │ ││
│  │  │  (Fire Events)      │   │   (FOR UPDATE SKIP LOCKED)          │ ││
│  │  └──────────┬──────────┘   └──────────┬──────────────────────────┘ ││
│  │             │                         │                             ││
│  │  ┌──────────▼──────────┐   ┌──────────▼──────────────────────────┐ ││
│  │  │  OutboxRepository   │   │      OutboxProcessorService         │ ││
│  │  │  (Save to DB)       │   │   (Poll & Publish to Kafka)         │ ││
│  │  └─────────────────────┘   └─────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     DATABASE LAYER                                   ││
│  │                                                                     ││
│  │  ┌─────────────────────┐   ┌─────────────────────────────────────┐ ││
│  │  │    PrismaService    │   │       PrismaModule                  │ ││
│  │  │  (DB Operations)    │   │   (DI Configuration)                │ ││
│  │  └─────────────────────┘   └─────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File and Folder Structure

```
services/inquiry/
│
├── prisma/
│   ├── schema.prisma              # Database schema definition
│   └── migrations/                # Database migration files
│       ├── 20251211123233_inquiry/
│       ├── 20251215_fix_enums/
│       └── 20251218194454_replace_inquiry_outbox_with_outbox_events/
│
├── generated/
│   └── prisma/                    # Auto-generated Prisma Client (don't edit)
│
├── src/
│   │
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module - wires everything together
│   ├── app.controller.ts          # Root controller (GET /)
│   ├── app.service.ts             # Root service
│   │
│   ├── inquiry/                   # 📁 INQUIRY MODULE (Core business logic)
│   │   ├── inquiry.module.ts      # Module configuration
│   │   ├── inquiry.controller.ts  # REST API endpoints
│   │   ├── inquiry.service.ts     # Business logic (CRUD, validation)
│   │   ├── inquiry-consumer.service.ts  # Kafka event consumer
│   │   │
│   │   ├── dto/                   # 📁 Data Transfer Objects
│   │   │   ├── index.ts           # Barrel export
│   │   │   ├── inquiry.dto.ts     # Inquiry DTOs (Create, Close, Response)
│   │   │   ├── message.dto.ts     # Message DTOs
│   │   │   ├── attachment.dto.ts  # Attachment DTOs
│   │   │   └── admin.dto.ts       # Admin operation DTOs
│   │   │
│   │   └── repository/            # 📁 Data Access Layer
│   │       ├── index.ts           # Barrel export
│   │       └── outbox.repository.ts  # Outbox persistence
│   │
│   ├── kafka/                     # 📁 KAFKA INTEGRATION
│   │   ├── index.ts               # Barrel export
│   │   ├── produce-events.ts      # Event producer (InquiryEventProducer)
│   │   └── prisma-outbox.adapter.ts  # Outbox adapter for kafka-publisher
│   │
│   ├── prisma/                    # 📁 DATABASE MODULE
│   │   ├── index.ts               # Barrel export
│   │   ├── prisma.module.ts       # Prisma module configuration
│   │   └── prisma.service.ts      # Prisma client wrapper
│   │
│   └── health/                    # 📁 HEALTH CHECK MODULE
│       ├── index.ts               # Barrel export
│       ├── health.module.ts       # Health module configuration
│       ├── health.controller.ts   # Health check endpoints
│       └── health.service.ts      # Health check logic
│
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── nest-cli.json                  # NestJS CLI configuration
└── .env                           # Environment variables (not in git)
```

### File-by-File Explanation

#### Entry Point

| File | Purpose |
|------|---------|
| `main.ts` | Bootstraps the NestJS application. Configures CORS, validation pipes, Swagger docs, API versioning, and graceful shutdown. |

#### Root Module

| File | Purpose |
|------|---------|
| `app.module.ts` | **Root module** that imports all other modules. Configures Kafka, database, and schedules. This is where you see the big picture. |
| `app.controller.ts` | Simple root endpoint returning "Inquiry Service is running!" |
| `app.service.ts` | Root service with a simple hello method. |

#### Inquiry Module (Core Business Logic)

| File | Purpose |
|------|---------|
| `inquiry.module.ts` | Declares providers, controllers, and exports for the inquiry feature. |
| `inquiry.controller.ts` | **REST API layer**. Defines 12 endpoints for inquiries, messages, attachments, and admin operations. |
| `inquiry.service.ts` | **Business logic**. Creates inquiries, adds messages, assigns admins, emits Kafka events. |
| `inquiry-consumer.service.ts` | **Kafka consumer**. Listens for `escrow.disputed` and `escrow.resolved` events to auto-create/close inquiries. |

#### DTOs (Data Transfer Objects)

| File | Purpose |
|------|---------|
| `inquiry.dto.ts` | DTOs for creating, closing, and responding with inquiry data. |
| `message.dto.ts` | DTOs for adding messages to inquiries. |
| `attachment.dto.ts` | DTOs for uploading attachments. |
| `admin.dto.ts` | DTOs for admin operations (assign, resolve). |

#### Repository

| File | Purpose |
|------|---------|
| `outbox.repository.ts` | **Repository pattern** for saving events to the outbox table. Triggers immediate processing if publisher is available. |

#### Kafka Integration

| File | Purpose |
|------|---------|
| `produce-events.ts` | **InquiryEventProducer** - saves events to outbox for each inquiry action (created, closed, message added, etc.). Fire-and-forget pattern. |
| `prisma-outbox.adapter.ts` | **PrismaOutboxAdapter** - implements the `OutboxAdapter` interface from `@escrowly/kafka-publisher`. Uses `FOR UPDATE SKIP LOCKED` for safe concurrent processing. |

#### Prisma Module

| File | Purpose |
|------|---------|
| `prisma.module.ts` | **DynamicModule** that provides `PrismaService` globally. Handles database URL configuration from environment or Secrets Manager. |
| `prisma.service.ts` | **Extends PrismaClient**. Manages connection lifecycle, logs queries in development, provides `cleanDatabase()` for testing. |

#### Health Module

| File | Purpose |
|------|---------|
| `health.service.ts` | Provides `check()` for basic health and `ready()` for database connectivity check. |
| `health.controller.ts` | Exposes `/api/v1/health` and `/api/v1/health/ready` endpoints. |

---

## Kafka Integration

### What is Kafka?

**Apache Kafka** is a distributed event streaming platform. Think of it as a highly reliable message queue that:

- **Decouples services** - Services don't need to know about each other
- **Guarantees delivery** - Messages are persisted and can be replayed
- **Scales horizontally** - Can handle millions of events per second
- **Enables real-time processing** - Events are processed as they happen

In Escrowly, we use **Redpanda** (a Kafka-compatible streaming platform) in development.

### How Kafka Works in This Project

```
┌───────────────────┐         ┌──────────────────┐         ┌───────────────────┐
│  Inquiry Service  │   -->   │  Kafka Broker    │   -->   │  Other Services   │
│  (Producer)       │         │  (Redpanda)      │         │  (Consumers)      │
└───────────────────┘         └──────────────────┘         └───────────────────┘

Events Flow:
1. User creates inquiry
2. InquiryService saves to DB
3. InquiryEventProducer saves event to outbox_events table
4. OutboxProcessorService polls outbox and publishes to Kafka
5. Other services (Notification, Analytics) consume the event
```

### Kafka Core Module (`@escrowly/kafka-core`)

A shared package providing centralized Kafka infrastructure.

**Location:** `packages/kafka-core/`

**Key Components:**

| Component | Purpose |
|-----------|---------|
| `KafkaModule` | NestJS module for easy integration |
| `KafkaService` | High-level API for producing and consuming events |
| `EscrowTopics` / `InquiryTopics` | Enum of all topic names |
| `BaseEvent<T>` | Standard event structure with metadata |
| Event Payloads | TypeScript interfaces for each event type |

**Topic Naming Convention:**

```typescript
// Domain.action.detail
inquiry.created            // Inquiry was created
inquiry.closed             // Inquiry was closed
inquiry.resolved           // Inquiry was resolved by admin
inquiry.assigned           // Inquiry was assigned to admin
inquiry.message.added      // Message added to inquiry
inquiry.attachment.uploaded // Attachment uploaded to inquiry
escrow.disputed            // Escrow dispute opened
```

**Example: Subscribing to Events**

```typescript
// In InquiryConsumerService
this.kafka.subscribe<DisputeOpenedPayload>(
  EscrowTopics.DISPUTED,
  async (event: BaseEvent<DisputeOpenedPayload>) => {
    // Handle the event
    await this.handleDisputeOpened(event);
  }
);
await this.kafka.startConsuming();
```

### Kafka Publisher & Outbox Pattern

#### What is the Outbox Pattern?

The **Transactional Outbox Pattern** solves the problem of reliably publishing events when Kafka might be down.

**The Problem:**
```typescript
// ❌ BAD: If Kafka fails, data is saved but event is lost
await prisma.inquiry.create({ data: {...} });
await kafka.produce('inquiry.created', payload); // What if this fails?
```

**The Solution:**
```typescript
// ✅ GOOD: Save event to outbox in same transaction
await prisma.$transaction(async (tx) => {
  await tx.inquiry.create({ data: {...} });
  await tx.outboxEvent.create({
    data: {
      topic: 'inquiry.created',
      payload: JSON.stringify(payload),
      status: 'pending',
    },
  });
});
// OutboxProcessor will publish to Kafka later
```

**Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRANSACTIONAL OUTBOX PATTERN                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐│
│   │ HTTP Request │ --> │InquiryService│ --> │ Database Transaction     ││
│   │ (Create)     │     │              │     │                          ││
│   └──────────────┘     └──────────────┘     │  1. Save inquiry         ││
│                                              │  2. Save outbox_event    ││
│                                              │     (status: 'pending')  ││
│                                              └──────────────────────────┘│
│                                                         │                │
│                                                         ▼                │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                     outbox_events TABLE                           │  │
│   │  ┌─────┬──────────────────┬─────────┬──────────────────────────┐ │  │
│   │  │ id  │ topic            │ status  │ payload                  │ │  │
│   │  ├─────┼──────────────────┼─────────┼──────────────────────────┤ │  │
│   │  │ 1   │ inquiry.created  │ pending │ {"inquiry": {...}}       │ │  │
│   │  │ 2   │ inquiry.assigned │ pending │ {"inquiryId": "..."}     │ │  │
│   │  └─────┴──────────────────┴─────────┴──────────────────────────┘ │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                         │                │
│                                           (Every 2 seconds)              │
│                                                         ▼                │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                  OutboxProcessorService                           │  │
│   │                                                                   │  │
│   │   1. SELECT * FROM outbox_events WHERE status='pending'          │  │
│   │      FOR UPDATE SKIP LOCKED                                      │  │
│   │                                                                   │  │
│   │   2. For each event:                                             │  │
│   │      - Publish to Kafka                                          │  │
│   │      - If success: UPDATE status='published'                     │  │
│   │      - If fail: INCREMENT retryCount, SET nextRetryAt            │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                         │                │
│                                                         ▼                │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                      KAFKA BROKER                                 │  │
│   │                                                                   │  │
│   │   Topic: inquiry.created  ────────────────►  Notification Service │  │
│   │   Topic: inquiry.assigned ────────────────►  Admin Dashboard      │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### OutboxAdapter Interface

The `PrismaOutboxAdapter` implements this interface from `@escrowly/kafka-publisher`:

```typescript
interface OutboxAdapter {
  findPendingEvents(limit: number): Promise<OutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string, retryCount: number, nextRetryAt: Date): Promise<void>;
  markPermanentlyFailed(id: string, error: string, retryCount: number): Promise<void>;
}
```

**Key Features:**

1. **`FOR UPDATE SKIP LOCKED`** - Prevents multiple instances from processing the same event
2. **Exponential Backoff** - Failed events are retried with increasing delays
3. **Max Retries** - After 5 failures, events are permanently marked failed

---

## Service Workflows

### Workflow 1: Create Inquiry

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CREATE INQUIRY WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   POST /api/v1/inquiries                                                 │
│   {                                                                      │
│     "escrow_id": "escrow-123",                                          │
│     "created_by": "550e8400-...",                                       │
│     "initial_message": "I have a question"                              │
│   }                                                                      │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  InquiryController.createInquiry()                               │  │
│   │     │                                                            │  │
│   │     ▼                                                            │  │
│   │  InquiryService.createInquiry(dto)                               │  │
│   │     │                                                            │  │
│   │     ├── 1. Check if inquiry exists for escrow (throw if yes)     │  │
│   │     │                                                            │  │
│   │     ├── 2. Transaction:                                          │  │
│   │     │      - Create inquiry record                               │  │
│   │     │      - Create initial message (if provided)                │  │
│   │     │                                                            │  │
│   │     └── 3. Fire event (fire-and-forget):                         │  │
│   │            InquiryEventProducer.inquiryCreated(payload)          │  │
│   │                │                                                 │  │
│   │                ▼                                                 │  │
│   │            OutboxRepository.save(topic, key, payload)            │  │
│   │                │                                                 │  │
│   │                ▼                                                 │  │
│   │            outbox_events table (status: 'pending')               │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   Response: { id, escrow_id, status: 'open', ... }                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Workflow 2: Auto-Create Inquiry on Dispute

```
┌─────────────────────────────────────────────────────────────────────────┐
│                AUTO-CREATE INQUIRY ON DISPUTE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Escrow Service publishes: escrow.disputed                              │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  Kafka Broker                                                    │  │
│   │     │                                                            │  │
│   │     ▼                                                            │  │
│   │  InquiryConsumerService.handleDisputeOpened(event)               │  │
│   │     │                                                            │  │
│   │     ├── 1. Check if inquiry exists for escrow                    │  │
│   │     │      (skip if yes)                                         │  │
│   │     │                                                            │  │
│   │     └── 2. Transaction:                                          │  │
│   │            - Create inquiry record                               │  │
│   │            - Create system message with dispute reason           │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   Result: Inquiry auto-created with dispute details                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Workflow 3: Admin Resolve Inquiry

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ADMIN RESOLVE INQUIRY                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   POST /api/v1/inquiries/admin/inquiries/{id}/resolve                   │
│   { "status": "closed", "resolution_note": "Issue resolved" }           │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  InquiryController.resolveInquiry()                              │  │
│   │     │                                                            │  │
│   │     ▼                                                            │  │
│   │  InquiryService.resolveInquiry(id, dto)                          │  │
│   │     │                                                            │  │
│   │     ├── 1. Find inquiry (throw 404 if not found)                 │  │
│   │     │                                                            │  │
│   │     ├── 2. Transaction:                                          │  │
│   │     │      - Update inquiry status to 'closed'                   │  │
│   │     │      - Add resolution message from admin                   │  │
│   │     │                                                            │  │
│   │     └── 3. Fire event:                                           │  │
│   │            InquiryEventProducer.inquiryResolved(payload)         │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   Published Event: inquiry.resolved                                      │
│   Consumers: Notification Service, Analytics, etc.                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Classes Explanation

### Abstract Classes vs Concrete Classes

In this codebase, we use **interfaces** rather than abstract classes for contracts. Here's the pattern:

#### Interface: `OutboxAdapter` (from @escrowly/kafka-publisher)

```typescript
// This is an INTERFACE - defines the contract
interface OutboxAdapter {
  findPendingEvents(limit: number): Promise<OutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: string, retryCount: number, nextRetryAt: Date): Promise<void>;
  markPermanentlyFailed(id: string, error: string, retryCount: number): Promise<void>;
}
```

**Why use an interface?**
- Services using this interface don't care HOW events are stored (Prisma, TypeORM, raw SQL)
- Each service implements its own adapter for its database
- Easy to test with mock implementations

#### Concrete Class: `PrismaOutboxAdapter`

```typescript
// This is a CONCRETE CLASS - implements the interface
@Injectable()
export class PrismaOutboxAdapter implements OutboxAdapter {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingEvents(limit: number): Promise<OutboxEvent[]> {
    // PostgreSQL-specific implementation with FOR UPDATE SKIP LOCKED
    const events = await this.prisma.$queryRaw`...`;
    return events;
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    });
  }
  // ... other methods
}
```

### Service Classes

| Class | Type | Purpose |
|-------|------|---------|
| `InquiryService` | Concrete | Business logic for inquiries |
| `InquiryEventProducer` | Concrete | Saves events to outbox (producer) |
| `InquiryConsumerService` | Concrete | Consumes Kafka events (consumer) |
| `OutboxRepository` | Concrete | Data access for outbox table |
| `PrismaOutboxAdapter` | Concrete | Implements `OutboxAdapter` interface |
| `PrismaService` | Concrete | Extends `PrismaClient`, adds lifecycle methods |
| `HealthService` | Concrete | Health check logic |

### NestJS Decorators Explained

```typescript
@Injectable()  // Makes the class available for dependency injection
@Controller()  // Marks class as a REST controller
@Module()      // Defines a NestJS module
@Get()         // HTTP GET endpoint
@Post()        // HTTP POST endpoint
@Body()        // Extract request body
@Param()       // Extract URL parameters
@Query()       // Extract query parameters
```

---

## Database & Prisma Schema

### What is Prisma?

**Prisma** is a next-generation ORM (Object-Relational Mapping) for Node.js. It provides:

- **Type-safe database queries** - Auto-generated TypeScript types
- **Schema migrations** - Version-controlled database changes
- **Query builder** - Intuitive API for database operations

### Database Schema

The Inquiry Service uses the `inquiry_db` schema in PostgreSQL.

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["inquiry_db"]
}

// === ENUMS ===

enum InquiryStatus {
  open
  closed
  @@schema("inquiry_db")
}

enum MessageSenderRole {
  buyer
  seller
  admin
  @@schema("inquiry_db")
}

// === MODELS ===

model inquiries {
  id                String        @id @default(uuid())
  escrow_id         String        @unique    // One inquiry per escrow
  created_by        String                    // User who created it
  assigned_admin_id String?                   // Admin handling the inquiry
  status            InquiryStatus @default(open)
  created_at        DateTime      @default(now())
  updated_at        DateTime      @updatedAt

  messages    inquiry_messages[]
  attachments inquiry_attachments[]

  @@schema("inquiry_db")
}

model inquiry_messages {
  id          String            @id @default(uuid())
  inquiry_id  String
  sender_id   String
  sender_role MessageSenderRole
  message     String?
  created_at  DateTime          @default(now())

  inquiry     inquiries              @relation(...)
  attachments inquiry_attachments[]

  @@schema("inquiry_db")
}

model inquiry_attachments {
  id         String   @id @default(uuid())
  inquiry_id String
  message_id String
  file_url   String
  file_type  String
  created_at DateTime @default(now())

  inquiry inquiries        @relation(...)
  message inquiry_messages @relation(...)

  @@schema("inquiry_db")
}

model OutboxEvent {
  id           String    @id @default(uuid())
  topic        String    // Kafka topic name
  partitionKey String    // For ordering (inquiryId)
  payload      String    @db.Text // JSON event data
  status       String    @default("pending")  // pending|published|failed
  retryCount   Int       @default(0)
  lastError    String?   @db.Text
  createdAt    DateTime  @default(now())
  publishedAt  DateTime?
  nextRetryAt  DateTime?

  @@index([status])
  @@index([createdAt])
  @@index([nextRetryAt])
  @@index([topic])
  @@schema("inquiry_db")
}
```

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐         ┌─────────────────────┐                   │
│   │    inquiries    │ 1     * │  inquiry_messages   │                   │
│   ├─────────────────┤─────────├─────────────────────┤                   │
│   │ id (PK)         │         │ id (PK)             │                   │
│   │ escrow_id (UQ)  │         │ inquiry_id (FK)     │───────┐           │
│   │ created_by      │         │ sender_id           │       │           │
│   │ assigned_admin  │         │ sender_role         │       │           │
│   │ status          │         │ message             │       │           │
│   │ created_at      │         │ created_at          │       │           │
│   │ updated_at      │         └─────────────────────┘       │           │
│   └─────────────────┘                   │                   │           │
│           │                             │ 1                 │           │
│           │ 1                           │                   │           │
│           │                     ┌───────▼─────────────┐     │           │
│           │     *               │inquiry_attachments  │     │ *         │
│           └─────────────────────├─────────────────────┤─────┘           │
│                                 │ id (PK)             │                  │
│                                 │ inquiry_id (FK)     │                  │
│                                 │ message_id (FK)     │                  │
│                                 │ file_url            │                  │
│                                 │ file_type           │                  │
│                                 │ created_at          │                  │
│                                 └─────────────────────┘                  │
│                                                                          │
│   ┌─────────────────────┐                                               │
│   │   outbox_events     │  (Transactional Outbox Pattern)               │
│   ├─────────────────────┤                                               │
│   │ id (PK)             │                                               │
│   │ topic               │  ← Kafka topic (e.g., "inquiry.created")      │
│   │ partitionKey        │  ← For ordering (inquiryId)                   │
│   │ payload             │  ← JSON event data                            │
│   │ status              │  ← pending | published | failed               │
│   │ retryCount          │  ← Number of publish attempts                 │
│   │ lastError           │  ← Error message if failed                    │
│   │ createdAt           │                                               │
│   │ publishedAt         │  ← When successfully published                │
│   │ nextRetryAt         │  ← For exponential backoff                    │
│   └─────────────────────┘                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Prisma Commands

```bash
# Generate Prisma Client (creates typed models)
npm run prisma:generate

# Create a new migration (development)
npm run prisma:migrate:dev

# Apply migrations (production/CI)
npm run prisma:migrate:deploy

# Open Prisma Studio (GUI for database)
npm run prisma:studio
```

---

## API Endpoints

### User/Buyer/Seller Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/inquiries` | Create a new inquiry |
| `GET` | `/api/v1/inquiries/:inquiryId` | Get inquiry by ID |
| `GET` | `/api/v1/inquiries/escrow/:escrowId` | Get inquiry by escrow ID |
| `POST` | `/api/v1/inquiries/:inquiryId/close` | Close an inquiry |

### Message Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/inquiries/:inquiryId/messages` | Add message to inquiry |
| `GET` | `/api/v1/inquiries/:inquiryId/messages` | List messages (paginated) |

### Attachment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/inquiries/:inquiryId/attachments` | Add attachment |
| `GET` | `/api/v1/inquiries/:inquiryId/attachments` | List attachments (paginated) |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/inquiries/admin/inquiries` | List all inquiries (with filters) |
| `GET` | `/api/v1/inquiries/admin/inquiries/:id` | Get full inquiry detail |
| `POST` | `/api/v1/inquiries/admin/inquiries/:id/assign` | Assign inquiry to admin |
| `POST` | `/api/v1/inquiries/admin/inquiries/:id/resolve` | Resolve inquiry |

### Health Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Basic health check |
| `GET` | `/api/v1/health/ready` | Readiness check (DB connectivity) |

---

## Getting Started

### Prerequisites

- **Node.js** v18+ (v20 recommended)
- **npm** v9+
- **Docker** and **Docker Compose** (for PostgreSQL and Kafka)
- **PostgreSQL** client (optional, for debugging)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd escrowly-backend

# Install all dependencies (from monorepo root)
npm install

# Build shared packages
cd packages/kafka-core && npm run build && cd ../..
cd packages/kafka-publisher && npm run build && cd ../..
cd packages/shared-config && npm run build && cd ../..
```

### Step 2: Start Infrastructure

```bash
# Start PostgreSQL
docker compose up -d postgres

# Wait for it to be healthy
docker compose logs -f postgres
# Look for: "database system is ready to accept connections"

# (Optional) Start Kafka for event streaming
docker compose --profile dev up -d redpanda kafka-ui
```

### Step 3: Configure Environment

```bash
cd services/inquiry

# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://escrowly_dev:escrowly_dev_password@localhost:5433/escrowly?schema=inquiry_db

# Service
PORT=3003
SERVICE_NAME=inquiry-service
NODE_ENV=development

# Kafka (set to true to enable)
KAFKA_ENABLED=false
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=inquiry-service
KAFKA_GROUP_ID=inquiry-consumer-group

# AWS (for secrets, can be empty in dev)
AWS_REGION=us-east-1
EOF
```

### Step 4: Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Apply migrations
npm run prisma:migrate:deploy
```

### Step 5: Run the Service

```bash
# Development mode (hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### Step 6: Verify

```bash
# Health check
curl http://localhost:3003/api/v1/health

# Swagger docs
open http://localhost:3003/api/docs
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3003` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `KAFKA_ENABLED` | Enable/disable Kafka | `false` |
| `KAFKA_BROKERS` | Kafka broker addresses | `localhost:9092` |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `inquiry-service` |
| `KAFKA_GROUP_ID` | Kafka consumer group | `inquiry-consumer-group` |
| `KAFKA_SSL` | Enable SSL for Kafka | `false` |
| `KAFKA_SASL_USERNAME` | SASL username (if auth required) | - |
| `KAFKA_SASL_PASSWORD` | SASL password (if auth required) | - |

### Kafka Publisher Configuration

```typescript
KafkaPublisherModule.forRoot({
  adapter: PrismaOutboxAdapter,
  config: {
    pollingIntervalMs: 2000,   // Poll outbox every 2 seconds
    batchSize: 20,             // Process up to 20 events per poll
    maxRetries: 5,             // Max retry attempts
    baseBackoffMs: 5000,       // Initial retry delay (5 seconds)
    maxBackoffMs: 60000,       // Max retry delay (60 seconds)
  },
})
```

---

## Testing

### Run Automated Tests

```bash
# From monorepo root
node scripts/test-inquiry.js
```

### Manual Testing with cURL

```bash
# Create inquiry
curl -X POST http://localhost:3003/api/v1/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "escrow_id": "escrow-test-123",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "initial_message": "I have a question"
  }'

# Add message
curl -X POST http://localhost:3003/api/v1/inquiries/{INQUIRY_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "550e8400-e29b-41d4-a716-446655440001",
    "sender_role": "seller",
    "message": "How can I help?"
  }'

# Assign to admin
curl -X POST http://localhost:3003/api/v1/inquiries/admin/inquiries/{INQUIRY_ID}/assign \
  -H "Content-Type: application/json" \
  -d '{
    "admin_id": "550e8400-e29b-41d4-a716-446655440002"
  }'

# Resolve inquiry
curl -X POST http://localhost:3003/api/v1/inquiries/admin/inquiries/{INQUIRY_ID}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "status": "closed",
    "resolution_note": "Issue resolved"
  }'
```

### Verify Outbox Events

```bash
# Connect to PostgreSQL
docker exec -it escrowly-postgres psql -U escrowly_dev -d escrowly

# Check outbox events
SELECT id, topic, status, "createdAt", "publishedAt" 
FROM inquiry_db.outbox_events 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### Check Kafka Events (if enabled)

1. Open Kafka UI: http://localhost:8080
2. Navigate to Topics
3. Look for: `inquiry.created`, `inquiry.message.added`, `inquiry.attachment.uploaded`, etc.

---

## Tips for Understanding the Code

### 1. Start with the Entry Point

Read files in this order:
1. `main.ts` - How the app starts
2. `app.module.ts` - What modules are loaded
3. `inquiry/inquiry.module.ts` - Inquiry feature structure
4. `inquiry/inquiry.controller.ts` - API endpoints
5. `inquiry/inquiry.service.ts` - Business logic

### 2. Follow the Data Flow

For any operation, trace:
1. **Controller** - Receives HTTP request
2. **Service** - Executes business logic
3. **Prisma** - Saves to database
4. **EventProducer** - Saves event to outbox
5. **OutboxProcessor** - Publishes to Kafka

### 3. Understand the Patterns

| Pattern | Where Used | Purpose |
|---------|------------|---------|
| Repository | `OutboxRepository` | Abstracts data access |
| Adapter | `PrismaOutboxAdapter` | Implements interface for specific DB |
| Fire-and-Forget | `InquiryEventProducer` | Non-blocking event emission |
| Transactional Outbox | `outbox_events` table | Reliable event delivery |

### 4. Use the Barrel Exports

```typescript
// ✅ Good - Use barrel exports
import { CreateInquiryDto, InquiryResponseDto } from './dto';

// ❌ Avoid - Direct file imports
import { CreateInquiryDto } from './dto/inquiry.dto';
```

### 5. Check the Logs

The service uses NestJS Logger with helpful prefixes:
```
[InquiryService] Creating inquiry for escrow: escrow-123
[InquiryEventProducer] Saved inquiry.created to outbox for abc-123
[OutboxProcessorService] Published 5 events to Kafka
```

### 6. Swagger is Your Friend

Open http://localhost:3003/api/docs to:
- See all endpoints
- Try requests interactively
- View request/response schemas

---

## License

UNLICENSED - Private repository for Escrowly platform.
