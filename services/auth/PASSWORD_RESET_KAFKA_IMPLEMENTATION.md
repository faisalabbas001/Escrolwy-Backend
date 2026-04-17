# Password Reset - Kafka Event Implementation

## Overview

The Auth Service no longer sends emails directly. Instead, it produces Kafka events that are consumed by the Notification Service, which handles email delivery.

---

## Changes Made

### 1. **kafka-core Package** - New Event Types

#### Topics (Already Existed):
```typescript
AuthTopics.PASSWORD_RESET_REQUESTED = 'auth.password.reset.requested'
AuthTopics.PASSWORD_CHANGED = 'auth.password.changed'
```

#### New Payload Types:
```typescript
export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  resetToken: string;
  expiresAt: string;
  requestedAt: string;
}

export interface PasswordChangedPayload {
  userId: string;
  email: string;
  changedAt: string;
  reason: 'reset' | 'user_change';
}
```

---

### 2. **Auth Service** - Event Producer Methods

#### New Methods in `AuthEventProducer`:

```typescript
// Emit password reset requested event
async passwordResetRequested(
  userId: string,
  email: string,
  resetToken: string,
  expiresAt: Date,
): Promise<void>

// Emit password changed event
async passwordChanged(
  userId: string,
  email: string,
  reason: 'reset' | 'user_change',
): Promise<void>
```

---

### 3. **Auth Service** - Updated Flows

| API Endpoint | Method | Event Produced |
|-------------|--------|----------------|
| `/auth/password/forgot` | `forgotPassword()` | `auth.password.reset.requested` |
| `/auth/password/reset` | `resetPassword()` | `auth.password.changed` (reason: 'reset') |
| `/auth/password/change` | `changePassword()` | `auth.password.changed` (reason: 'user_change') |

---

### 4. **Removed Components**

| Component | Status |
|-----------|--------|
| `src/email/email.service.ts` | ❌ Deleted |
| `src/email/email.module.ts` | ❌ Deleted |
| `src/email/` folder | ❌ Deleted |
| `EmailModule` import from `auth.module.ts` | ❌ Removed |
| Nodemailer dependency usage | ❌ Removed |

---

### 5. **Database Migration**

#### Migration: `20251219010110_update_outbox_schema`

Updated `outbox_events` table schema:

**Before:**
```sql
event_id         UUID
event_type       TEXT
partition_key    TEXT
retry_count      INTEGER
last_error       TEXT
next_retry_at    TIMESTAMPTZ
created_at       TIMESTAMPTZ
published_at     TIMESTAMPTZ
```

**After:**
```sql
partitionKey     TEXT
retryCount       INTEGER
lastError        TEXT
nextRetryAt      TIMESTAMPTZ
createdAt        TIMESTAMPTZ
publishedAt      TIMESTAMPTZ
```

**Changes:**
- Removed `event_id` and `event_type` columns
- Renamed all snake_case columns to camelCase
- Updated indexes to use new column names

---

## Event Flow

### Forget Password Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User requests password reset                            │
│     POST /api/v1/auth/password/forgot                       │
│     { "email": "user@example.com" }                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Auth Service                                            │
│     • Validate user exists                                  │
│     • Generate secure reset token                           │
│     • Hash token and store in password_reset_tokens table   │
│     • Emit event: auth.password.reset.requested            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. OutboxRepository                                        │
│     • Save event to outbox_events table                     │
│     • Status: pending                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Kafka Publisher (OutboxProcessorService)                │
│     • Poll outbox_events table                              │
│     • Publish to Kafka topic                                │
│     • Update status: published                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Notification Service (Consumer)                         │
│     • Consume event from Kafka                              │
│     • Send password reset email via Nodemailer              │
│     • Email contains reset link with token                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing

### Test Forget Password API

```bash
curl -X POST http://localhost:3000/api/v1/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Expected Response:**
```json
{
  "message": "Password reset link has been sent to your email"
}
```

### Verify Event in Outbox

```sql
SELECT 
  id, 
  topic, 
  "partitionKey", 
  status, 
  "retryCount", 
  "createdAt",
  payload
FROM auth_db.outbox_events 
WHERE topic = 'auth.password.reset.requested' 
ORDER BY "createdAt" DESC 
LIMIT 1;
```

**Expected Result:**
```
topic: auth.password.reset.requested
status: pending
payload: {
  "userId": "...",
  "email": "user@example.com",
  "resetToken": "...",
  "expiresAt": "...",
  "requestedAt": "..."
}
```

---

## Event Payloads

### Password Reset Requested Event

**Topic:** `auth.password.reset.requested`

**Payload:**
```json
{
  "userId": "1cfd74c3-5c1f-4b4d-b240-6bca1ec9f503",
  "email": "user@example.com",
  "resetToken": "5a0334cad03b9ffa6c82349da231662df38b42bd6854366c9459bf9007a121a5",
  "expiresAt": "2025-12-18T21:03:51.772Z",
  "requestedAt": "2025-12-18T20:03:51.782Z"
}
```

### Password Changed Event

**Topic:** `auth.password.changed`

**Payload:**
```json
{
  "userId": "1cfd74c3-5c1f-4b4d-b240-6bca1ec9f503",
  "email": "user@example.com",
  "changedAt": "2025-12-18T20:05:30.123Z",
  "reason": "reset"  // or "user_change"
}
```

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Decoupling** | Auth Service no longer depends on email infrastructure |
| **Reliability** | Events stored in outbox ensure no data loss |
| **Scalability** | Notification Service can be scaled independently |
| **Retry Logic** | Failed email sends are automatically retried |
| **Observability** | All events tracked in outbox table |
| **Flexibility** | Easy to add SMS, push notifications, etc. |

---

## Next Steps

The Notification Service should:

1. Subscribe to `auth.password.reset.requested` topic
2. Consume events and send password reset emails
3. Subscribe to `auth.password.changed` topic
4. Send password change confirmation emails

---

**Last Updated:** December 19, 2025
