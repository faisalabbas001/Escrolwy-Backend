# Ledger Service - Events Produced

The Ledger service produces the following Kafka events using the Transactional Outbox Pattern:

## Events Produced

### 1. `ledger.transfer_posted` (LedgerTopics.TRANSFER_POSTED)

**When**: Produced when a transfer is successfully journaled (double-entry accounting completed).

**Payload**: `TransferPostedPayload`
```typescript
{
  transferId: string;
  type: 'internal' | 'external';
  asset: string;
  amount: number;
  chain: string;
  senderId: string;
  destinationUserId?: string;
  destinationAddress?: string;
  destinationChain: string;
  journalId: string;
  postedAt: string;
}
```

**Consumers**:
- Notification Service: Notify users of transfer completion
- Analytics Service: Track transfer metrics
- Other services: React to transfer events

**Produced in**: `TransferEventService.createTransferPostedEvent()`

---

### 2. `ledger.balance_updated` (LedgerTopics.BALANCE_UPDATED)

**When**: Produced when account balances change due to transfer entries being created.

**Payload**: `BalanceUpdatedPayload`
```typescript
{
  accountId: string;
  ownerType: string;
  ownerId?: string;
  asset: string;
  chain: string;
  purpose: string;
  balance: number;
  updatedAt: string;
}
```

**Note**: This event is produced for **both** sender and receiver accounts when a transfer completes.

**Consumers**:
- Frontend/UI: Refresh user balance displays
- Notification Service: Alert users of balance changes
- Analytics Service: Track balance changes

**Produced in**: `TransferEventService.createBalanceUpdatedEvents()`

---

### 3. `ledger.external_payout_created` (LedgerTopics.EXTERNAL_PAYOUT_CREATED)

**When**: Produced only for external transfers (Escrowly → Blockchain) when a transfer is journaled.

**Payload**: `ExternalPayoutCreatedPayload`
```typescript
{
  transferId: string;
  asset: string;
  amount: number;
  chain: string;
  senderId: string;
  destinationAddress: string;
  destinationChain: string;
  createdAt: string;
}
```

**Consumers**:
- Blockchain Worker Service: Process external payouts to blockchain
- Notification Service: Notify users of payout initiation

**Produced in**: `TransferEventService.createExternalPayoutEvent()`

---

## Event Production Flow

```
Transfer Created
    ↓
TransferExecutorService.execute()
    ↓
1. Validate balance
2. Create transfer record
3. Create journal
4. Create entries (double-entry)
5. Update transfer status
6. TransferEventService.createEvents()
    ↓
    ├─→ TRANSFER_POSTED event
    ├─→ BALANCE_UPDATED event (sender account)
    ├─→ BALANCE_UPDATED event (receiver account)
    └─→ EXTERNAL_PAYOUT_CREATED event (if external)
    ↓
All events written to ledger_outbox table
    ↓
KafkaPublisherModule polls and publishes to Kafka
```

## Transactional Guarantee

All events are written to the `ledger_outbox` table **within the same database transaction** as the transfer, ensuring:

- ✅ **ACID Guarantee**: If transfer commits, events are guaranteed to be persisted
- ✅ **No Lost Events**: Events cannot be lost even if Kafka is temporarily unavailable
- ✅ **Reliable Publishing**: `OutboxProcessorService` automatically retries failed publishes
- ✅ **Idempotency**: Event keys prevent duplicate processing

## Event Keys

- **TRANSFER_POSTED**: `transfer.idempotencyKey || transfer.id`
- **BALANCE_UPDATED**: `account.id`
- **EXTERNAL_PAYOUT_CREATED**: `payout-${transfer.id}`

## Implementation Details

All events are produced via `TransferEventService`, which:
- Uses `OutboxRepository` to write events to `ledger_outbox` table
- Supports transaction context (events written in same transaction as transfer)
- Uses typed payloads from `@escrowly/kafka-core` for type safety
- Follows SOLID principles (Single Responsibility)

## Testing

To verify events are produced:

1. **Check outbox table**:
```sql
SELECT event_type, event_key, status, created_at 
FROM ledger_db.ledger_outbox 
ORDER BY created_at DESC 
LIMIT 10;
```

2. **Check Kafka topics**:
- Use Kafka UI or CLI to inspect topics
- Topics: `ledger.transfer_posted`, `ledger.balance_updated`, `ledger.external_payout_created`

3. **Monitor logs**:
- `OutboxProcessorService` logs successful publishes
- Check for any failed events in `ledger_outbox` table

