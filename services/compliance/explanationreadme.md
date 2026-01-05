# Compliance Service – API & Events Documentation

## Service Overview

The **Compliance Service** is the single source of truth for:
- User KYC (Know Your Customer) lifecycle
- Risk evaluation and flagging
- Financial limits enablement
- Compliance audit & reporting

**Port:** 3003
**Swagger:** http://localhost:3003/api/docs

---

## API Endpoints

### KYC Module

#### 1. Start KYC Process
```
POST /api/v1/kyc/start
```

**Description:** Initiates KYC verification for a user. Creates a Persona inquiry and redirects user to verification UI.

**Headers:**
- `Authorization: Bearer <JWT>` or `x-user-id: <UUID>` (for testing)

**Request Body:**
```json
{
  "referenceId": "optional-reference-id",
  "redirectUri": "https://app.example.com/kyc-complete"
}
```

**Response (201):**
```json
{
  "status": "STARTED",
  "inquiryId": "inq_xxx",
  "verificationUrl": "https://withpersona.com/verify?inquiry-id=inq_xxx",
  "message": "KYC process started. Complete verification at the URL."
}
```

**Use Case:** Called when a user wants to verify their identity to unlock higher transaction limits.

**Events Emitted:**
- `compliance.kyc.started`

---

#### 2. Get KYC Status
```
GET /api/v1/kyc/status
```

**Description:** Returns the current KYC status for the authenticated user.

**Headers:**
- `Authorization: Bearer <JWT>` or `x-user-id: <UUID>`

**Response (200):**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440099",
  "status": "APPROVED",
  "inquiryId": "inq_xxx",
  "createdAt": "2025-12-23T12:00:00Z",
  "updatedAt": "2025-12-23T13:00:00Z"
}
```

**Status Values:**
- `NOT_STARTED` - User has never initiated KYC
- `STARTED` - KYC in progress
- `APPROVED` - Verified successfully
- `REJECTED` - Verification failed
- `REVIEW_REQUIRED` - Manual admin review needed

---

#### 3. Persona Webhook
```
POST /api/v1/kyc/webhook
```

**Description:** Callback endpoint for Persona to send verification results. Server-to-server only.

**Headers:**
- `Persona-Signature: t=timestamp,v1=signature`

**Request Body:** Persona webhook payload (inquiry.approved, inquiry.declined, etc.)

**Response (200):**
```json
{
  "success": true,
  "message": "KYC status updated to APPROVED"
}
```

**Use Case:** Persona calls this endpoint after user completes verification. Updates KYC status and creates limits.

**Events Emitted:**
- `compliance.kyc.approved` (if approved)
- `compliance.kyc.rejected` (if rejected)
- `compliance.kyc.review_required` (if needs review)
- `compliance.limits.updated` (if approved)
- `compliance.events` (KYC updated for Auth service)

---

### Limits Module (S2S API)

#### 4. Get User Limits (JWT Required)
```
GET /api/v1/s2s/limits/:userId
```

**Description:** Returns all limits for a user. Requires JWT authentication for security.

**Headers:**
- `Authorization: Bearer <JWT>` *(Required)*

**Response (200):**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440099",
  "escrowLimit": 50000,
  "ledgerLimit": 100000,
  "hasLimits": true,
  "updatedAt": "2025-12-23T13:00:00Z"
}
```

**Response (401 - Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Use Case:** Escrow and Ledger services call this API (with service JWT) to verify user transaction limits before processing operations.

**Security:** Protected by `JwtAuthGuard` to ensure only authenticated services can access limit data.

---

### Admin Module

#### 5. Get Flagged Users
```
GET /api/v1/admin/kyc/flagged
```

**Description:** Returns list of users with REVIEW_REQUIRED status.

**Response (200):**
```json
[
  {
    "userId": "550e8400-e29b-41d4-a716-446655440099",
    "inquiryId": "inq_xxx",
    "status": "REVIEW_REQUIRED",
    "risks": [...],
    "createdAt": "2025-12-23T12:00:00Z"
  }
]
```

**Use Case:** Admin reviews flagged users to make manual approval/rejection decisions.

---

#### 6. Approve KYC (Manual)
```
PATCH /api/v1/admin/kyc/:userId/approve
```

**Description:** Manually approves a user's KYC.

**Request Body:**
```json
{
  "reason": "Documents verified manually"
}
```

**Response (200):**
```json
{
  "success": true,
  "userId": "550e8400-e29b-41d4-a716-446655440099",
  "status": "APPROVED",
  "limits": {
    "escrowLimit": 50000,
    "ledgerLimit": 100000
  }
}
```

**Events Emitted:**
- `compliance.kyc.approved`
- `compliance.limits.updated`
- `compliance.events`

---

#### 7. Reject KYC (Manual)
```
PATCH /api/v1/admin/kyc/:userId/reject
```

**Description:** Manually rejects a user's KYC.

**Request Body:**
```json
{
  "reason": "Fraudulent documents detected"
}
```

**Response (200):**
```json
{
  "success": true,
  "userId": "550e8400-e29b-41d4-a716-446655440099",
  "status": "REJECTED",
  "reason": "Fraudulent documents detected"
}
```

**Events Emitted:**
- `compliance.kyc.rejected`
- `compliance.events`

---

#### 8. Adjust Limits
```
PATCH /api/v1/admin/limits/:userId
```

**Description:** Manually adjusts escrow/ledger limits for an approved user.

**Request Body:**
```json
{
  "escrowLimit": 75000,
  "ledgerLimit": 150000
}
```

**Response (200):**
```json
{
  "success": true,
  "userId": "550e8400-e29b-41d4-a716-446655440099",
  "escrowLimit": 75000,
  "ledgerLimit": 150000
}
```

**Events Emitted:**
- `compliance.limits.updated`

---

#### 9. Reset KYC
```
POST /api/v1/admin/kyc/:userId/reset
```

**Description:** Resets KYC for a user (exceptional cases only). Deletes all KYC records, risks, and limits.

**Request Body:**
```json
{
  "reason": "User requested document re-verification"
}
```

**Response (201):**
```json
{
  "success": true,
  "userId": "550e8400-e29b-41d4-a716-446655440099",
  "message": "KYC has been reset. User can now start a new KYC process.",
  "reason": "User requested document re-verification"
}
```

---

## Kafka Events

### Events Produced

| Topic | Description | Consumers |
|-------|-------------|-----------|
| `compliance.kyc.started` | KYC process initiated | Notifications |
| `compliance.kyc.approved` | KYC approved | Escrow, Ledger, Notifications |
| `compliance.kyc.rejected` | KYC rejected | Notifications |
| `compliance.kyc.review_required` | Manual review needed | Admin, Notifications |
| `compliance.limits.updated` | User limits changed | Escrow, Ledger |
| `compliance.events` | Generic KYC updated | Auth Service |

### Event Payloads

#### kyc.started
```json
{
  "userId": "uuid",
  "inquiryId": "inq_xxx",
  "referenceId": "optional",
  "startedAt": "2025-12-23T12:00:00Z"
}
```

#### kyc.approved
```json
{
  "userId": "uuid",
  "inquiryId": "inq_xxx",
  "state": "VERIFIED",
  "providerRef": "inq_xxx",
  "limits": {
    "escrowLimit": 50000,
    "ledgerLimit": 100000
  },
  "at": "2025-12-23T12:00:00Z"
}
```

#### kyc.rejected
```json
{
  "userId": "uuid",
  "inquiryId": "inq_xxx",
  "state": "REJECTED",
  "providerRef": "inq_xxx",
  "reason": "optional reason",
  "at": "2025-12-23T12:00:00Z"
}
```

#### kyc.review_required
```json
{
  "userId": "uuid",
  "inquiryId": "inq_xxx",
  "state": "PENDING",
  "riskFlags": [...],
  "at": "2025-12-23T12:00:00Z"
}
```

#### limits.updated
```json
{
  "userId": "uuid",
  "escrowLimit": 75000,
  "ledgerLimit": 150000,
  "updatedAt": "2025-12-23T12:00:00Z"
}
```

#### compliance.events (for Auth Service)
```json
{
  "userId": "uuid",
  "state": "VERIFIED" | "REJECTED" | "PENDING",
  "providerRef": "inq_xxx",
  "at": "2025-12-23T12:00:00Z"
}
```

### Events Consumed

| Topic | Handler | Action |
|-------|---------|--------|
| `auth.user.created` | UserCreatedHandler | Logs user registration for KYC readiness |

---

## Database Schema

### Tables (PostgreSQL - compliance_db schema)

#### kyc_records
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Unique user identifier |
| persona_inquiry_id | VARCHAR | Persona inquiry ID |
| status | ENUM | STARTED, APPROVED, REJECTED, REVIEW_REQUIRED |
| metadata | JSONB | Additional data |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

#### risks
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User identifier |
| risk_type | VARCHAR | Type of risk |
| severity | VARCHAR | low, medium, high |
| source | VARCHAR | Source (e.g., persona) |
| created_at | TIMESTAMP | Record creation |

#### limits
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Unique user identifier |
| kyc_record_id | UUID | FK to kyc_records |
| escrow_limit | DECIMAL | Escrow transaction limit |
| ledger_limit | DECIMAL | Ledger transaction limit |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Compliance Service (3003)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ KYC Module  │  │   Limits    │  │   Admin     │            │
│  │             │  │   Module    │  │   Module    │            │
│  │ POST /start │  │ (JWT Secured│  │ GET /flagged│            │
│  │ POST /hook  │  │ GET /:userId│  │ PATCH /appr │            │
│  │ GET /status │  │             │  │ PATCH /rej  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         │                 │                │                    │
│         └─────────────────┴────────────────┘                    │
│                           │                                     │
│              ┌────────────┴────────────┐                       │
│              │   ComplianceEventProducer│                       │
│              │   (Transactional Outbox) │                       │
│              └────────────┬────────────┘                       │
│                           │                                     │
│              ┌────────────┴────────────┐                       │
│              │      Kafka Topics       │                       │
│              │  compliance.kyc.*       │                       │
│              │  compliance.limits.*    │                       │
│              └────────────┬────────────┘                       │
│                           │                                     │
│         ┌─────────────────┴─────────────────┐                  │
│         ▼                                   ▼                  │
│   ┌───────────┐                      ┌───────────┐            │
│   │   Auth    │                      │  Escrow   │            │
│   │  Service  │                      │  Ledger   │            │
│   └───────────┘                      └───────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decision Logic

| Persona Result | Risk Flags | Compliance Decision |
|----------------|------------|---------------------|
| Approved | None | Auto approve + enable limits |
| Approved | Present | Flag user, admin review |
| Rejected | Any | Reject, no limits |
| Needs Review | Any | Manual admin decision |

---

## Security

- **Webhook Signature Verification:** HMAC-SHA256
- **Idempotent Processing:** WebhookEvent table
- **Role-Based Access:** Admin endpoints require elevated privileges
- **Environment Isolation:** Sandbox vs Production (Persona)

---

## Production-Grade Enhancements

### 1. Webhook Signature Verification
**File:** `persona/persona.service.ts`

- HMAC-SHA256 signature validation using `PERSONA_WEBHOOK_SECRET`
- Parses Persona signature format: `t=timestamp,v1=signature`
- 5-minute timestamp window to prevent replay attacks
- Timing-safe comparison to prevent timing attacks
- Configurable bypass for development (when secret not set)

### 2. KYC State Machine
**File:** `kyc/kyc-state-machine.ts`

Enforces strict status transitions:
```
NOT_STARTED → STARTED
STARTED → APPROVED | REJECTED | REVIEW_REQUIRED
REVIEW_REQUIRED → APPROVED | REJECTED
```

- Rejects invalid transitions with `BadRequestException`
- Terminal state detection (APPROVED/REJECTED)
- Admin bypass for reset operations

### 3. Rate Limiting
**File:** `kyc/guards/kyc-rate-limit.guard.ts`

- **Limit:** 3 attempts per user per hour on `POST /kyc/start`
- In-memory storage (use Redis in production)
- Returns `429 Too Many Requests` with `retryAfter` header
- Prevents abuse and excessive Persona API costs

### 4. Audit Logging
**Files:** `audit/audit.service.ts`, `audit/audit.module.ts`

**Database Table:** `audit_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User identifier |
| action | TEXT | Action type (KYC_STARTED, etc.) |
| details | JSONB | Additional context |
| ip_address | TEXT | Client IP |
| user_agent | TEXT | Client user agent |
| created_at | TIMESTAMP | When logged |

**Actions Logged:**
- `KYC_STARTED`, `KYC_APPROVED`, `KYC_REJECTED`, `KYC_REVIEW_REQUIRED`
- `KYC_RESET`, `LIMITS_CREATED`, `LIMITS_UPDATED`
- `ADMIN_APPROVE`, `ADMIN_REJECT`, `ADMIN_ADJUST_LIMITS`
- `WEBHOOK_RECEIVED`




## Project Workflow

The Compliance Service operates as the central authority for user verification. The typical workflow is:

1.  **User Registration (Auth Service)**
    *   User signs up in Auth Service.
    *   Auth Service publishes `auth.user.created`.
    *   Compliance Service consumes this event (via `UserCreatedHandler`) to prepare for KYC.

2.  **KYC Initiation**
    *   User requests to start KYC (`POST /kyc/start`).
    *   Compliance Service calls Persona API to create an "Inquiry".
    *   User is redirected to Persona's hosted flow to submit ID documents.
    *   Status set to `STARTED`.

3.  **Verification & Webhook**
    *   User completes Persona flow.
    *   Persona assesses risk and sends a webhook to `POST /kyc/webhook`.
    *   Compliance Service verifies webhook signature (HMAC).

4.  **Decisioning**
    *   **Auto-Approval:** If Persona returns "approved" with no risk flags -> Status `APPROVED`, Limits set.
    *   **Manual Review:** If Persona returns "needs_review" or risk flags exist -> Status `REVIEW_REQUIRED`. Admin must manually approve.
    *   **Rejection:** If Persona returns "declined" -> Status `REJECTED`.

5.  **Event Propagation**
    *   On status change, Compliance Service emits events (e.g., `compliance.kyc.approved`, `compliance.limits.updated`).
    *   **Auth Service** listens to update user status (active/frozen).
    *   **Escrow/Ledger Services** listen to know if user can transact.

---

## Detailed Kafka Event Flow

The service uses the **Transactional Outbox Pattern** to ensure reliable event delivery.

### 1. Producer (The "Write" Side)
When a business action occurs (e.g., KYC Approval):
*   **Action:** `AdminService` updates `kyc_records` table in Postgres.
*   **Event:** Inside the *same database transaction*, `ComplianceEventProducer` writes the event payload to the `outbox_events` table.
*   **Result:** Database atomicity guarantees that if the action commits, the event is saved. No "dual-write" issues.

### 2. Outbox Processor (The "Relay" Side)
A background service (`OutboxProcessorService`):
*   **Polls:** Continuously checks `outbox_events` table for `pending` events.
*   **Locks:** Uses `SKIP LOCKED` to allow multiple instances to process events safely without duplication.
*   **Publishes:** Sends the payload to the actual Kafka Broker (Redpanda/Kafka).
*   **Updates:** Marks the database record as `published` upon success.

### 3. Consumer (The "Read" Side)
*   `ComplianceConsumer` subscribes to relevant topics (e.g., `auth.user.created`).
*   Delegates processing to specific handlers (e.g., `UserCreatedHandler`).
*   Handlers are idempotent to handle potential duplicate entries.

---

## Folder Structure Explanation

The service is organized by **Feature Modules**:

*   **`admin/`**
    *   Contains `AdminController` and `AdminService`.
    *   Handles privileged operations like fetching flagged users, manual approvals (overriding Persona), and resetting KYC.
    *   Enforces Role-Based Access Control (RBAC).

*   **`audit/`**
    *   **Purpose:** Centralized logging for compliance-critical actions.
    *   **`AuditService`:** Provides a simple `.log()` method used by other services.
    *   **Storage:** Saves structured logs to the `audit_logs` table (who did what, when, and previous/new values).
    *   **Usage:** critical for regulatory compliance and tracing admin actions.

*   **`health/`**
    *   Standard health check endpoints for Kubernetes/Load Balancers.
    *   Checks DB connectivity and Kafka status.

*   **`kafka/`**
    *   **Core:** `KafkaEventsModule` configures the connection.
    *   **Producer:** `ComplianceEventProducer` (user-facing API to emit events).
    *   **Adapter:** `PrismaOutboxAdapter` (low-level DB logic for outbox).
    *   **Consumers:** Handlers for incoming events from other services.

*   **`kyc/`**
    *   The heart of the service.
    *   `KycService`: Orchestrates the flow.
    *   `KycRepository`: Database abstraction.
    *   `KycStateMachine`: Logic to prevent invalid state transitions (e.g., can't go from Rejected to Started without Reset).

*   **`limits/`**
    *   Manages financial transaction limits (`user_limits` table).
    *   Exposes **JWT-secured** S2S API for Ledger/Escrow services to check user transaction limits.
    *   All endpoints require `JwtAuthGuard` authentication for security.

*   **`persona/`**
    *   Strictly handles integration with the 3rd-party Persona API.
    *   Handles signature verification (`verifyWebhookSignature`) and payload parsing.

*   **`prisma/`**
    *   Contains the `schema.prisma` file defining the database structure.
    *   Generated Prisma Client.

--- 

## New Files Added

| File | Purpose |
|------|---------|
| `kyc/kyc-state-machine.ts` | KYC status transition validator |
| `kyc/guards/kyc-rate-limit.guard.ts` | Rate limiter for /kyc/start |
| `audit/audit.service.ts` | Audit logging service |
| `audit/audit.module.ts` | Audit module (global) |
| `audit/index.ts` | Barrel exports |

