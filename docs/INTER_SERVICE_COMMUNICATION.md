# Inter-Service Communication Architecture

## Overview

This document describes how services communicate in the Escrowly platform. We use **two patterns**:

1. **Kafka Events (Fire-and-Forget)** - Primary pattern for inter-service communication
2. **REST APIs (Synchronous)** - Only when immediate response is required

## Communication Patterns

### 1. Kafka Events (Fire-and-Forget) - PRIMARY

**When to use**: Most inter-service communication

**How it works**:
- Service A publishes event to Kafka
- Service B consumes event asynchronously
- No immediate response needed
- Service A doesn't wait for Service B

**Benefits**:
- ✅ Decoupled services
- ✅ Non-blocking
- ✅ Resilient (events persist in outbox)
- ✅ Scalable (multiple consumers)

**Example Flow**:
```
Escrow Service                    Kafka                    Ledger Service
     │                              │                            │
     │ escrow.payment.completed    │                            │
     ├─────────────────────────────>│                            │
     │                              │                            │
     │                              │ escrow.payment.completed   │
     │                              ├───────────────────────────>│
     │                              │                            │ (reserves funds)
     │ (continues immediately)      │                            │
```

### 2. REST APIs (Synchronous) - MINIMAL USE

**When to use**: Only when Service A needs an immediate response to proceed

**Current usage**:
- ✅ **Balance checks**: Escrow needs immediate response to validate before creating escrow

**NOT used for**:
- ❌ Reservations (handled via Kafka events)
- ❌ Transfers (handled via Kafka events)
- ❌ Releases (handled via Kafka events)

**Example Flow**:
```
Escrow Service                    Ledger Service
     │                                  │
     │ POST /balance-check              │
     ├─────────────────────────────────>│
     │                                  │ (validates balance)
     │ { sufficient: true }             │
     │<─────────────────────────────────┤
     │ (proceeds with escrow creation)  │
```

## Escrow ↔ Ledger Communication

### REST API Calls (Synchronous)

**Only ONE endpoint used**:

| Endpoint | Purpose | When Used |
|----------|---------|-----------|
| `POST /v1/ledger/users/:id/balance-check` | Check balance sufficiency | Before creating escrow (fee validation) |

**Why REST?**: Escrow service needs immediate response to fail fast if balance is insufficient.

### Kafka Events (Fire-and-Forget)

**Escrow → Ledger Events**:

| Event | Topic | Ledger Action |
|-------|-------|---------------|
| `escrow.created` | `escrow.created` | None (informational) |
| `escrow.payment.completed` | `escrow.payment.completed` | Reserve buyer funds |
| `escrow.accepted` | `escrow.accepted` | Reserve seller funds (if fee split) |
| `escrow.completed` | `escrow.completed` | Release funds to seller |
| `escrow.refunded` | `escrow.refunded` | Refund to buyer |
| `escrow.cancelled` | `escrow.cancelled` | Refund to buyer (if funded) |
| `escrow.disputed` | `escrow.disputed` | Freeze funds |
| `escrow.resolved` | `escrow.resolved` | Process resolution (varies) |

**Ledger → Escrow Events**:

| Event | Topic | Escrow Action |
|-------|-------|--------------|
| `ledger.transfer_posted` | `ledger.transfer_posted` | Update escrow status (optional) |
| `ledger.balance_updated` | `ledger.balance_updated` | Refresh UI (optional) |

## Implementation Details

### Escrow Service

**REST API Client** (`LedgerClientService`):
```typescript
// Only balance check method
async checkBalance(userId, amount, asset, chain): Promise<BalanceCheckResult>
```

**Kafka Event Producer** (`EscrowEventProducer`):
```typescript
// Fire-and-forget events
async paymentCompleted(escrowId, buyerId, sellerId, amount, ...)
async escrowCompleted(escrowId, ...)
async disputeOpened(escrowId, ...)
// ... etc
```

### Ledger Service

**REST API Endpoints** (Internal Only):
- `POST /v1/ledger/users/:id/balance-check` - Used by Escrow service

**Kafka Event Consumers**:
- Consumes `escrow.payment.completed` → Reserves funds
- Consumes `escrow.completed` → Releases funds
- Consumes `escrow.disputed` → Freezes funds
- ... etc

## Why This Architecture?

### Why Kafka for Most Operations?

1. **Decoupling**: Services don't need to know about each other
2. **Resilience**: Events persist in outbox, survive service crashes
3. **Scalability**: Multiple consumers can process events
4. **Non-blocking**: Escrow service doesn't wait for Ledger

### Why REST for Balance Checks?

1. **Fail Fast**: Escrow needs immediate validation before creating escrow
2. **User Experience**: Better to reject immediately than create escrow and fail later
3. **Synchronous Validation**: Balance check is part of escrow creation workflow

## Migration Path

If you need to add a new inter-service operation:

1. **Ask**: Does Service A need immediate response to proceed?
   - **Yes** → Use REST API (add to `ILedgerClient` interface)
   - **No** → Use Kafka event (add to event producer)

2. **Example**: Adding "Check if user is KYC verified"
   - **REST**: If Escrow needs immediate response before creating escrow
   - **Kafka**: If Escrow can proceed and Auth service verifies later

## Security

### REST APIs (Internal Only)

- Protected by `@ServiceOnly()` decorator
- Requires `X-Service-Api-Key` header
- Not accessible to public or authenticated users

### Kafka Events

- Authenticated via Kafka SASL/SSL
- Events include metadata (source, timestamp, correlation ID)
- Idempotency keys prevent duplicates

## Monitoring

### REST API Calls

Monitor:
- Response times
- Error rates
- Service availability

### Kafka Events

Monitor:
- Event production rate
- Event consumption lag
- Outbox queue size
- Failed events

## Best Practices

1. ✅ **Prefer Kafka** for inter-service communication
2. ✅ **Use REST only** when immediate response is required
3. ✅ **Keep REST APIs minimal** - only what's necessary
4. ✅ **Document event flows** - what triggers what
5. ✅ **Handle failures gracefully** - both REST and Kafka
6. ✅ **Use idempotency keys** - prevent duplicate operations
7. ✅ **Monitor both** - REST calls and Kafka events

## Related Documentation

- [Internal APIs Security](./INTERNAL_APIS_SECURITY.md)
- [Escrow Kafka Integration](../services/escrow/src/kafka/README.md)
- [Ledger Kafka Events](../services/ledger/src/kafka/EVENTS_PRODUCED.md)

