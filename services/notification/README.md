# Notification Service

> A production-ready NestJS microservice for email notifications in the Escrowly platform.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Diagram](#architecture-diagram)
- [File and Folder Structure](#file-and-folder-structure)
- [Kafka Integration](#kafka-integration)
  - [What is Kafka?](#what-is-kafka)
  - [Kafka Core Module](#kafka-core-module)
  - [Kafka Publisher & Outbox Pattern](#kafka-publisher--outbox-pattern)
- [Service Workflows](#service-workflows)
- [Database & Prisma Schema](#database--prisma-schema)
- [API Endpoints](#api-endpoints)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [Tips for Understanding the Code](#tips-for-understanding-the-code)

---

## Project Overview

### What is the Notification Service?

The **Notification Service** is a microservice responsible for sending **email-only** notifications to users based on events from other Escrowly services. It consumes Kafka events, checks user preferences, renders email templates, and sends emails via Resend.

### Purpose

- **Email notifications** - Sends transactional emails based on Kafka events
- **User preferences** - Respects user opt-out settings per notification type
- **Template rendering** - Uses Handlebars for dynamic email content
- **Idempotency** - Prevents duplicate processing of Kafka events
- **Retry logic** - Automatically retries failed email deliveries
- **Event publishing** - Emits `notification.email.sent` and `notification.email.failed` events

### Service Scope (Strict)

**✅ Email Only**
- Sends emails via Resend API
- No SMS, Push, or In-App notifications
- No WebSocket connections

**✅ Event-Driven**
- Consumes Kafka events from other services
- Never mutates domain data
- Reactive service (no direct HTTP triggers for sending)

**✅ User Preferences**
- Checks user notification settings before sending
- Respects opt-out preferences per event type

### How it Fits in the System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ESCROWLY PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐ │
│  │ Auth Service │   │Escrow Service│   │Inquiry Service│   │  Wallet  │ │
│  │  (port 3000) │   │  (port 3004) │   │  (port 3003)  │   │ Service  │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └─────┬─────┘ │
│         │                  │                  │                  │       │
│         │                  │    Kafka Events  │                  │       │
│         └──────────────────┼──────────────────┼──────────────────┘       │
│                            │                  │                          │
│                     ┌──────▼──────────────────▼──────┐                  │
│                     │         KAFKA BROKER           │                  │
│                     │  (Redpanda / Apache Kafka)      │                  │
│                     └──────────────┬─────────────────┘                  │
│                                    │                                     │
│                     ┌──────────────▼─────────────────┐                  │
│                     │   Notification Service         │                  │
│                     │      (port 3005)                │                  │
│                     │  - Consumes events              │                  │
│                     │  - Sends emails via Resend     │                  │
│                     │  - Publishes notification.*    │                  │
│                     └─────────────────────────────────┘                  │
│                                                                          │
│                     ┌─────────────────────────────────────────┐          │
│                     │         PostgreSQL Database             │          │
│                     │  ┌─────────┐ ┌──────────────┐          │          │
│                     │  │ auth_db │ │notification_db│          │          │
│                     │  └─────────┘ └──────────────┘          │          │
│                     └─────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      NOTIFICATION SERVICE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                       HTTP LAYER (REST API)                         ││
│  │                                                                     ││
│  │  ┌─────────────────────┐   ┌─────────────────────────────────────┐ ││
│  │  │NotificationsController│ │       HealthController              │ ││
│  │  │  /api/v1/notifications│ │       /api/v1/health                │ ││
│  │  └──────────┬──────────┘   └─────────────────────────────────────┘ ││
│  └─────────────┼───────────────────────────────────────────────────────┘│
│                │                                                         │
│  ┌─────────────▼───────────────────────────────────────────────────────┐│
│  │                       SERVICE LAYER                                  ││
│  │                                                                     ││
│  │  ┌─────────────────────┐   ┌─────────────────────────────────────┐ ││
│  │  │ NotificationsService│   │  NotificationConsumerService         │ ││
│  │  │  (Orchestrator)     │   │   (Kafka Event Consumer)              │ ││
│  │  └──────────┬──────────┘   └──────────┬──────────────────────────┘ ││
│  │             │                         │                             ││
│  │  ┌──────────▼──────────┐   ┌──────────▼──────────────────────────┐ ││
│  │  │  PreferencesService │   │      TemplateService                  │ ││
│  │  │  (User Settings)    │   │   (Handlebars + Redis)                │ ││
│  │  └─────────────────────┘   └──────────┬──────────────────────────┘ ││
│  │                                       │                             ││
│  │  ┌───────────────────────────────────▼──────────────────────────┐  ││
│  │  │              EmailService (Resend API)                       │  ││
│  │  └──────────────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                │                                                         │
│  ┌─────────────▼───────────────────────────────────────────────────────┐│
│  │                       KAFKA LAYER                                    ││
│  │                                                                     ││
│  │  ┌─────────────────────┐   ┌─────────────────────────────────────┐ ││
│  │  │NotificationEventProducer│ │      PrismaOutboxAdapter          │ ││
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
services/notification/
│
├── prisma/
│   ├── schema.prisma              # Database schema definition
│   └── migrations/                # Database migration files
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
│   ├── api/                       # 📁 REST API MODULE
│   │   ├── api.module.ts          # Module configuration
│   │   ├── notifications.controller.ts  # REST API endpoints
│   │   └── dto/                   # Data Transfer Objects
│   │       ├── index.ts
│   │       ├── notification-settings.dto.ts
│   │       ├── test-email.dto.ts
│   │       └── notification-log.dto.ts
│   │
│   ├── consumer/                  # 📁 KAFKA CONSUMER MODULE
│   │   ├── consumer.module.ts     # Module configuration
│   │   └── notification-consumer.service.ts  # Kafka event consumer
│   │
│   ├── email/                     # 📁 EMAIL MODULE
│   │   ├── email.module.ts        # Module configuration
│   │   └── email.service.ts       # Resend API integration
│   │
│   ├── template/                  # 📁 TEMPLATE MODULE
│   │   ├── template.module.ts     # Module configuration
│   │   └── template.service.ts    # Handlebars rendering + Redis caching
│   │
│   ├── preferences/               # 📁 PREFERENCES MODULE
│   │   ├── preferences.module.ts  # Module configuration
│   │   └── preferences.service.ts # User notification settings
│   │
│   ├── processed-events/          # 📁 IDEMPOTENCY MODULE
│   │   ├── processed-events.module.ts
│   │   └── processed-events.service.ts  # Event deduplication
│   │
│   ├── notifications/             # 📁 CORE NOTIFICATIONS MODULE
│   │   ├── notifications.module.ts
│   │   └── notifications.service.ts  # Main orchestrator
│   │
│   ├── mapper/                    # 📁 EVENT MAPPER
│   │   ├── index.ts
│   │   └── notification.mapper.ts  # Maps Kafka events → Email intents
│   │
│   ├── retry/                     # 📁 RETRY MODULE
│   │   ├── retry.module.ts
│   │   └── retry.service.ts      # Failed notification retry logic
│   │
│   ├── kafka/                     # 📁 KAFKA INTEGRATION
│   │   ├── index.ts               # Barrel export
│   │   ├── produce-events.ts      # Event producer (NotificationEventProducer)
│   │   ├── outbox.repository.ts   # Outbox persistence
│   │   └── prisma-outbox.adapter.ts  # Outbox adapter for kafka-publisher
│   │
│   ├── prisma/                    # 📁 DATABASE MODULE
│   │   ├── index.ts               # Barrel export
│   │   ├── prisma.module.ts       # Prisma module configuration
│   │   └── prisma.service.ts      # Prisma client wrapper
│   │
│   ├── health/                    # 📁 HEALTH CHECK MODULE
│   │   ├── index.ts               # Barrel export
│   │   ├── health.module.ts       # Health module configuration
│   │   ├── health.controller.ts   # Health check endpoints
│   │   └── health.service.ts      # Health check logic
│   │
│   └── auth/                      # 📁 AUTH MODULE
│       └── user-status.checker.ts # StatusGuard implementation
│
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── nest-cli.json                  # NestJS CLI configuration
├── Dockerfile                     # Docker build configuration
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
| `app.module.ts` | **Root module** that imports all other modules. Configures Kafka, database, outbox publisher, and global guards (StatusGuard). |
| `app.controller.ts` | Simple root endpoint returning "Notification Service is running!" |
| `app.service.ts` | Root service with a simple hello method. |

#### Core Modules

| File | Purpose |
|------|---------|
| `notifications.service.ts` | **Main orchestrator**. Processes Kafka events, checks idempotency, preferences, renders templates, sends emails, logs results, and emits events. |
| `notification-consumer.service.ts` | **Kafka consumer**. Subscribes to events from Inquiry, Escrow, Auth, and Wallet services. Uses typed payloads from `@escrowly/kafka-core`. |
| `email.service.ts` | **Resend integration**. Sends emails via Resend API. Handles errors gracefully. |
| `template.service.ts` | **Template rendering**. Uses Handlebars to render email templates. Caches compiled templates in Redis (with in-memory fallback). |
| `preferences.service.ts` | **User preferences**. Loads and evaluates user notification settings. Creates default preferences if missing. |
| `processed-events.service.ts` | **Idempotency**. Tracks processed Kafka events to prevent duplicate notifications. |

#### Kafka Integration

| File | Purpose |
|------|---------|
| `produce-events.ts` | **NotificationEventProducer** - saves events to outbox for notification state changes (sent, failed). Fire-and-forget pattern. |
| `outbox.repository.ts` | **Repository pattern** for saving events to the outbox table. Triggers immediate processing if publisher is available. |
| `prisma-outbox.adapter.ts` | **PrismaOutboxAdapter** - implements the `OutboxAdapter` interface from `@escrowly/kafka-publisher`. Uses `FOR UPDATE SKIP LOCKED` for safe concurrent processing. |

#### API Module

| File | Purpose |
|------|---------|
| `notifications.controller.ts` | **REST API layer**. Defines endpoints for user settings, notification history, and admin operations. |

#### Retry Module

| File | Purpose |
|------|---------|
| `retry.service.ts` | **Retry logic**. Cron job that processes failed notifications with exponential backoff. |

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

### How Kafka Works in This Service

```
┌───────────────────┐         ┌──────────────────┐         ┌───────────────────┐
│  Other Services   │   -->   │  Kafka Broker    │   -->   │ Notification      │
│  (Producers)      │         │  (Redpanda)      │         │ Service           │
│                   │         │                  │         │ (Consumer)        │
└───────────────────┘         └──────────────────┘         └───────────────────┘

Events Consumed:
1. inquiry.message.added
2. inquiry.resolved
3. escrow.created
4. escrow.completed
5. escrow.disputed
6. auth.password.changed
7. auth.user.updated

Events Produced:
1. notification.email.sent
2. notification.email.failed
```

### Kafka Core Module (`@escrowly/kafka-core`)

A shared package providing centralized Kafka infrastructure.

**Location:** `packages/kafka-core/`

**Key Components:**

| Component | Purpose |
|-----------|---------|
| `KafkaModule` | NestJS module for easy integration |
| `KafkaService` | High-level API for producing and consuming events |
| `InquiryTopics` / `EscrowTopics` / `AuthTopics` | Enum of all topic names |
| `BaseEvent<T>` | Standard event structure with metadata |
| Event Payloads | TypeScript interfaces for each event type |

**Example: Consuming Events**

```typescript
// In NotificationConsumerService
this.kafka.subscribe<InquiryMessageAddedPayload>(
  InquiryTopics.MESSAGE_ADDED,
  async (event: BaseEvent<InquiryMessageAddedPayload>) => {
    await this.notificationsService.processEvent(event);
  }
);
await this.kafka.startConsuming();
```

### Kafka Publisher & Outbox Pattern

#### What is the Outbox Pattern?

The **Transactional Outbox Pattern** solves the problem of reliably publishing events when Kafka might be down.

**The Problem:**
```typescript
// ❌ BAD: If Kafka fails, email is sent but event is lost
await emailService.sendEmail(...);
await kafka.produce('notification.email.sent', payload); // What if this fails?
```

**The Solution:**
```typescript
// ✅ GOOD: Save event to outbox in same transaction
await prisma.$transaction(async (tx) => {
  await tx.notificationLog.create({ data: {...} });
  await tx.outboxEvent.create({
    data: {
      topic: 'notification.email.sent',
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
│   │ Kafka Event  │ --> │Notifications│ --> │ Database Transaction     ││
│   │ (Consumed)   │     │Service       │     │                          ││
│   └──────────────┘     └──────────────┘     │  1. Send email           ││
│                                              │  2. Save notification_log││
│                                              │  3. Save outbox_event   ││
│                                              │     (status: 'pending') ││
│                                              └──────────────────────────┘│
│                                                         │                │
│                                                         ▼                │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                     outbox_events TABLE                           │  │
│   │  ┌─────┬──────────────────────────┬─────────┬──────────────────┐ │  │
│   │  │ id  │ topic                    │ status  │ payload          │ │  │
│   │  ├─────┼──────────────────────────┼─────────┼──────────────────┤ │  │
│   │  │ 1   │ notification.email.sent  │ pending │ {"userId": ...} │ │  │
│   │  │ 2   │ notification.email.failed│ pending │ {"error": ...}  │ │  │
│   │  └─────┴──────────────────────────┴─────────┴──────────────────┘ │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                         │                │
│                                           (Every 2 seconds)              │
│                                                         ▼                │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                  OutboxProcessorService                           │  │
│   │                                                                   │  │
│   │   1. SELECT * FROM outbox_events WHERE status='pending'         │  │
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
│   │   Topic: notification.email.sent  ───►  Analytics Service       │  │
│   │   Topic: notification.email.failed ───►  Monitoring Service     │  │
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

### Workflow 1: Process Kafka Event and Send Email

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  PROCESS EVENT AND SEND EMAIL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Kafka Event: inquiry.message.added                                    │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  NotificationConsumerService.handleEvent(event)                  │  │
│   │     │                                                            │  │
│   │     ▼                                                            │  │
│   │  NotificationsService.processEvent(event)                         │  │
│   │     │                                                            │  │
│   │     ├── 1. Check idempotency (processed_events table)            │  │
│   │     │      (skip if already processed)                            │  │
│   │     │                                                            │  │
│   │     ├── 2. Map event to email intent(s)                          │  │
│   │     │      NotificationMapper.mapEventToIntents(event)           │  │
│   │     │                                                            │  │
│   │     ├── 3. For each intent:                                      │  │
│   │     │      ├── Check user preferences                            │  │
│   │     │      │   PreferencesService.isAllowed(userId, eventType)  │  │
│   │     │      │   (skip if user opted out)                          │  │
│   │     │      │                                                     │  │
│   │     │      ├── Render template                                   │  │
│   │     │      │   TemplateService.render(templateId, variables)     │  │
│   │     │      │                                                     │  │
│   │     │      ├── Send email                                        │  │
│   │     │      │   EmailService.sendEmail(to, subject, html)         │  │
│   │     │      │                                                     │  │
│   │     │      ├── Log notification                                  │  │
│   │     │      │   notification_logs table                           │  │
│   │     │      │                                                     │  │
│   │     │      └── Emit event (via outbox)                           │  │
│   │     │          NotificationEventProducer.notificationSent()      │  │
│   │     │                                                            │  │
│   │     └── 4. Mark event as processed                                │  │
│   │            processed_events table                                 │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   Result: Email sent, logged, and event published                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Workflow 2: Retry Failed Notification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RETRY FAILED NOTIFICATION                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Cron Job: Every minute                                                │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  RetryService.processFailedNotifications()                        │  │
│   │     │                                                            │  │
│   │     ├── 1. Find failed notifications                             │  │
│   │     │      WHERE status='failed' AND retryCount < 5              │  │
│   │     │                                                            │  │
│   │     ├── 2. For each failed notification:                         │  │
│   │     │      ├── Check user preferences again                     │  │
│   │     │      │   (user might have opted out)                       │  │
│   │     │      │                                                     │  │
│   │     │      ├── Re-render template                                │  │
│   │     │      │                                                     │  │
│   │     │      ├── Retry sending email                               │  │
│   │     │      │                                                     │  │
│   │     │      ├── If success:                                       │  │
│   │     │      │   - Update status='sent'                            │  │
│   │     │      │   - Emit notification.email.sent                    │  │
│   │     │      │                                                     │  │
│   │     │      └── If failure:                                       │  │
│   │     │          - Increment retryCount                            │  │
│   │     │          - Set nextRetryAt (exponential backoff)          │  │
│   │     │          - Emit notification.email.failed                  │  │
│   │     │                                                            │  │
│   │     └── 3. If retryCount >= 5:                                   │  │
│   │            Move to DLQ (future implementation)                   │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Workflow 3: User Updates Notification Settings

```
┌─────────────────────────────────────────────────────────────────────────┐
│              USER UPDATES NOTIFICATION SETTINGS                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PUT /api/v1/notifications/settings                                    │
│   {                                                                      │
│     "emailInquiryMessages": false,                                      │
│     "emailEscrowCreated": true                                          │
│   }                                                                      │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  NotificationsController.updateMySettings()                       │  │
│   │     │                                                            │  │
│   │     ▼                                                            │  │
│   │  PreferencesService.updatePreferences(userId, updates)            │  │
│   │     │                                                            │  │
│   │     └── UPSERT user_notification_settings                         │  │
│   │            (create if missing, update if exists)                 │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   Response: Updated settings                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database & Prisma Schema

### Schema Overview

The Notification Service uses the `notification_db` schema in a shared PostgreSQL instance.

### Models

#### 1. `UserNotificationSettings`

Stores per-user email notification preferences.

```prisma
model UserNotificationSettings {
  id                    String   @id @default(uuid())
  userId                String   @unique
  emailInquiryMessages  Boolean  @default(true)
  emailInquiryResolved  Boolean  @default(true)
  emailEscrowCreated    Boolean  @default(true)
  emailEscrowCompleted  Boolean  @default(true)
  emailEscrowDisputed   Boolean  @default(true)
  emailWalletDeposit    Boolean  @default(true)
  emailWalletWithdrawal Boolean  @default(true)
  emailPasswordChanged  Boolean  @default(true)
  emailEmailUpdated     Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

#### 2. `NotificationLog`

Append-only log of all email delivery attempts.

```prisma
model NotificationLog {
  id            String    @id @default(uuid())
  userId        String
  eventType     String
  eventKey      String?
  templateId    String
  recipientEmail String
  subject       String
  status        String    // sent | failed | skipped
  errorMessage  String?
  resendId      String?
  createdAt     DateTime  @default(now())
}
```

#### 3. `ProcessedEvent`

Tracks processed Kafka events for idempotency.

```prisma
model ProcessedEvent {
  id          String   @id @default(uuid())
  eventKey    String   @unique
  eventType   String
  processedAt DateTime @default(now())
}
```

#### 4. `OutboxEvent`

Transactional outbox for reliable event publishing.

```prisma
model OutboxEvent {
  id           String    @id @default(uuid())
  topic        String
  partitionKey String
  payload      String
  status       String    @default("pending") // pending | published | failed
  retryCount   Int       @default(0)
  lastError    String?
  nextRetryAt  DateTime?
  publishedAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

### Migrations

Run migrations from the monorepo root:

```bash
# Generate Prisma client
npm run notification:prisma:generate

# Create and apply migration
npm run notification:prisma:migrate:dev

# Apply migrations in production
npm run notification:prisma:migrate:deploy
```

---

## API Endpoints

### Base URL

```
http://localhost:3005/api/v1
```

### Swagger Documentation

```
http://localhost:3005/api/docs
```

### User Endpoints

#### Get Notification Settings

```http
GET /api/v1/notifications/settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "emailInquiryMessages": true,
  "emailInquiryResolved": true,
  "emailEscrowCreated": true,
  "emailEscrowCompleted": true,
  "emailEscrowDisputed": true,
  "emailWalletDeposit": true,
  "emailWalletWithdrawal": true,
  "emailPasswordChanged": true,
  "emailEmailUpdated": true
}
```

#### Update Notification Settings

```http
PUT /api/v1/notifications/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "emailInquiryMessages": false,
  "emailEscrowCreated": true
}
```

#### Get Notification History

```http
GET /api/v1/notifications/history?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "...",
      "userId": "...",
      "eventType": "inquiry.message.added",
      "templateId": "inquiry_message_sent_v1",
      "recipientEmail": "user@example.com",
      "subject": "New message in inquiry...",
      "status": "sent",
      "resendId": "re_...",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Admin Endpoints

#### Get User Settings (Admin)

```http
GET /api/v1/notifications/admin/settings/:userId
Authorization: Bearer <admin-token>
```

#### Update User Settings (Admin)

```http
PUT /api/v1/notifications/admin/settings/:userId
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "emailInquiryMessages": false
}
```

#### Query Notification Logs (Admin)

```http
GET /api/v1/notifications/admin/logs?status=failed&eventType=inquiry.message.added&page=1&limit=50
Authorization: Bearer <admin-token>
```

#### Send Test Email (Admin)

```http
POST /api/v1/notifications/admin/test-send
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "to": "test@example.com",
  "subject": "Test Email",
  "html": "<p>This is a test email.</p>"
}
```

#### Retry Failed Notification (Admin)

```http
POST /api/v1/notifications/admin/retry/:notificationId
Authorization: Bearer <admin-token>
```

### Health Endpoints

#### Health Check

```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "notification-service",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

#### Readiness Check

```http
GET /api/v1/health/ready
```

**Response:**
```json
{
  "status": "ready",
  "service": "notification-service",
  "database": "connected",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis (optional, for template caching)
- Kafka/Redpanda (for event consumption)

### Installation

1. **Install dependencies** (from monorepo root):

```bash
npm install
```

2. **Generate Prisma client**:

```bash
npm run notification:prisma:generate
```

3. **Run database migrations**:

```bash
npm run notification:prisma:migrate:dev
```

4. **Create `.env` file**:

```env
# Service Configuration
NODE_ENV=development
PORT=3005
SERVICE_NAME=notification-service

# Database
DATABASE_URL=postgresql://user:password@localhost:5433/escrowly?schema=notification_db

# Kafka
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=notification-service
KAFKA_GROUP_ID=notification-consumer-group

# Resend (Email)
RESEND_ENABLED=true
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=notifications@escrowly.com

# Redis (Optional - for template caching)
REDIS_URL=redis://localhost:6379
# Or with password: redis://:password@localhost:6379

# JWT (for API authentication)
JWT_SECRET=your-secret-key
JWT_ISSUER=escrowly-auth
JWT_AUDIENCE=escrowly
```

5. **Start the service**:

```bash
npm run notification:dev
```

The service will start on `http://localhost:3005`

### Docker Compose

The service is included in the root `docker-compose.yml`. Start all services:

```bash
docker-compose up -d
```

---

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `PORT` | HTTP server port | `3005` | No |
| `SERVICE_NAME` | Service identifier | `notification-service` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `KAFKA_ENABLED` | Enable Kafka consumer | `false` | No |
| `KAFKA_BROKERS` | Kafka broker addresses | `localhost:9092` | No |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `notification-service` | No |
| `KAFKA_GROUP_ID` | Kafka consumer group | `notification-consumer-group` | No |
| `RESEND_ENABLED` | Enable Resend email sending | `false` | No |
| `RESEND_API_KEY` | Resend API key | - | Yes (if enabled) |
| `RESEND_FROM_EMAIL` | Default sender email | `notifications@escrowly.com` | No |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | No |
| `JWT_SECRET` | JWT verification secret | - | Yes (for API) |
| `JWT_ISSUER` | JWT issuer | `escrowly-auth` | No |
| `JWT_AUDIENCE` | JWT audience | `escrowly` | No |

### Kafka Configuration

The service uses `@escrowly/kafka-core` for Kafka integration. Configuration is done in `app.module.ts`:

```typescript
KafkaModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    clientId: config.get("KAFKA_CLIENT_ID", "notification-service"),
    groupId: config.get("KAFKA_GROUP_ID", "notification-consumer-group"),
    brokers: config.get("KAFKA_BROKERS", "localhost:9092"),
    enabled: config.get("KAFKA_ENABLED", "false") === "true",
    // ... SSL/SASL configuration
  }),
})
```

### Outbox Publisher Configuration

The outbox publisher is configured in `app.module.ts`:

```typescript
KafkaPublisherModule.forRoot({
  adapter: PrismaOutboxAdapter,
  config: {
    pollingIntervalMs: 2000,  // Poll every 2 seconds
    batchSize: 20,            // Process 20 events per batch
    maxRetries: 5,            // Max retry attempts
    baseBackoffMs: 5000,      // Initial backoff (5 seconds)
    maxBackoffMs: 60000,      // Max backoff (60 seconds)
  },
})
```

---

## Testing

### Unit Tests

```bash
npm run test -w services/notification
```

### E2E Tests

```bash
npm run test:e2e -w services/notification
```

### Test Coverage

```bash
npm run test:cov -w services/notification
```

### Manual Testing

1. **Start the service**:
```bash
npm run notification:dev
```

2. **Send a test email** (requires admin token):
```bash
curl -X POST http://localhost:3005/api/v1/notifications/admin/test-send \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>This is a test email.</p>"
  }'
```

3. **Check notification logs**:
```bash
curl http://localhost:3005/api/v1/notifications/admin/logs \
  -H "Authorization: Bearer <admin-token>"
```

---

## Tips for Understanding the Code

### 1. Start with the Consumer

The `NotificationConsumerService` is the entry point for event processing. It subscribes to Kafka topics and delegates to `NotificationsService`.

### 2. Follow the Event Flow

```
Kafka Event → Consumer → NotificationsService → Mapper → Preferences → Template → Email → Log → Outbox
```

### 3. Understand Idempotency

The `ProcessedEventsService` ensures each Kafka event is processed only once, even if the service restarts or events are replayed.

### 4. Template Caching

The `TemplateService` caches compiled Handlebars templates in Redis. If Redis is unavailable, it falls back to in-memory caching.

### 5. Retry Logic

The `RetryService` runs a cron job every minute to retry failed notifications with exponential backoff.

### 6. Outbox Pattern

All events are published via the transactional outbox pattern. Events are saved to the database first, then published to Kafka by a background processor.

### 7. User Preferences

User preferences are checked before sending any email. Default preferences are created automatically if missing.

---

## Key Design Decisions

### Why Email Only?

The service is designed to be **email-only** to keep it simple and focused. Future channels (SMS, Push) should be separate services or modules.

### Why Event-Driven?

The service is **reactive** - it only sends emails in response to Kafka events. This ensures:
- Decoupling from other services
- Reliable delivery (events can be replayed)
- Scalability (can handle high event volumes)

### Why Outbox Pattern?

The outbox pattern ensures **reliable event publishing** even when Kafka is down. Events are saved to the database first, then published asynchronously.

### Why Idempotency?

Kafka events can be replayed. The `ProcessedEvent` table ensures each event is processed only once, preventing duplicate emails.

### Why Redis for Templates?

Redis caching improves performance by avoiding recompilation of Handlebars templates. The service gracefully degrades to in-memory caching if Redis is unavailable.

---

## Troubleshooting

### Emails Not Sending

1. Check `RESEND_ENABLED` and `RESEND_API_KEY` in `.env`
2. Check notification logs: `GET /api/v1/notifications/admin/logs?status=failed`
3. Check Resend dashboard for delivery status

### Events Not Consuming

1. Check `KAFKA_ENABLED=true` in `.env`
2. Verify Kafka broker connectivity
3. Check consumer group status in Kafka

### Templates Not Rendering

1. Check template IDs match in `TemplateService`
2. Verify template variables are provided
3. Check Redis connection (if using Redis caching)

### Database Connection Issues

1. Verify `DATABASE_URL` includes `schema=notification_db`
2. Check PostgreSQL is running
3. Verify migrations have been applied

---

## Production Considerations

### Monitoring

- Monitor notification logs for failure rates
- Track email delivery success/failure
- Monitor Kafka consumer lag
- Alert on high retry counts

### Scaling

- Run multiple instances (Kafka consumer group handles distribution)
- Use Redis for shared template cache
- Monitor database connection pool

### Security

- Use AWS Secrets Manager for production secrets
- Rotate Resend API keys regularly
- Use TLS for Kafka connections
- Implement rate limiting for API endpoints

---

## License

UNLICENSED - Private Escrowly Platform

