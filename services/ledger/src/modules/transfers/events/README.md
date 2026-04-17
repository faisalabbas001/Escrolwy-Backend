# Transfer Events - SOLID Principles Implementation

This module handles Kafka event production for transfers following SOLID principles and flat code practices.

## Architecture

The event production follows **SOLID principles** and **flat code practices**:

### File Structure (Flat)

```
transfers/events/
├── producers/                              # Event producers (SRP)
│   ├── index.ts
│   ├── event-producer.interface.ts         # Producer interface (DIP)
│   ├── transfer-posted.producer.ts         # TRANSFER_POSTED producer
│   ├── balance-updated.producer.ts        # BALANCE_UPDATED producer
│   └── external-payout.producer.ts         # EXTERNAL_PAYOUT_CREATED producer
└── README.md                               # This file
```

## SOLID Principles Applied

### 1. Single Responsibility Principle (SRP)

Each producer has a single, well-defined responsibility:

- **`TransferPostedEventProducer`**: Produces TRANSFER_POSTED events only
- **`BalanceUpdatedEventProducer`**: Produces BALANCE_UPDATED events only
- **`ExternalPayoutEventProducer`**: Produces EXTERNAL_PAYOUT_CREATED events only
- **`TransferEventService`**: Orchestrates event production

### 2. Open/Closed Principle (OCP)

- New event producers can be added without modifying existing code
- Producers implement `IEventProducer` interface, allowing extension
- New event types can be added by creating new producer classes

### 3. Liskov Substitution Principle (LSP)

- All producers implement `IEventProducer` interface
- Any producer implementation can be substituted without breaking the service

### 4. Interface Segregation Principle (ISP)

- `IEventProducer` interface is focused - only contains `produce()` method
- No "fat" interfaces forcing unnecessary dependencies

### 5. Dependency Inversion Principle (DIP)

- `TransferEventService` depends on producer interfaces, not concrete implementations
- Producers depend on repository interfaces (via dependency injection)
- Easy to mock for testing

## Event Producers

### Transfer Posted Producer

Produces `LedgerTopics.TRANSFER_POSTED` events:

- **When**: Every transfer is journaled (both internal and external)
- **Payload**: `TransferPostedPayload`
- **Event Key**: `transfer.idempotencyKey || transfer.id`

### Balance Updated Producer

Produces `LedgerTopics.BALANCE_UPDATED` events:

- **When**: Account balances change due to transfer entries
- **Payload**: `BalanceUpdatedPayload`
- **Event Key**: `account.id`
- **Note**: Produced for both sender and receiver accounts

### External Payout Producer

Produces `LedgerTopics.EXTERNAL_PAYOUT_CREATED` events:

- **When**: Only for external transfers (Escrowly → Blockchain)
- **Payload**: `ExternalPayoutCreatedPayload`
- **Event Key**: `payout-${transfer.id}`

## Usage

The producers are automatically injected into `TransferEventService`:

```typescript
// transfer-event.service.ts
constructor(
  private readonly transferPostedProducer: TransferPostedEventProducer,
  private readonly balanceUpdatedProducer: BalanceUpdatedEventProducer,
  private readonly externalPayoutProducer: ExternalPayoutEventProducer,
) {}
```

## Adding New Event Producers

To add a new event producer:

1. **Create producer class**:
```typescript
// producers/new-event.producer.ts
@Injectable()
export class NewEventProducer implements IEventProducer<NewEventData> {
  constructor(private readonly outboxRepository: OutboxRepository) {}

  async produce(data: NewEventData, tx?: any): Promise<void> {
    const payload: NewEventPayload = { /* ... */ };
    await this.outboxRepository.create({
      eventType: LedgerTopics.NEW_EVENT,
      eventKey: data.key,
      payload: payload as any,
      status: 'pending',
    }, tx);
  }
}
```

2. **Register in TransferEventService**:
```typescript
// transfer-event.service.ts
constructor(
  // ... existing producers
  private readonly newEventProducer: NewEventProducer,
) {}

async createEvents(...) {
  // ... existing events
  await this.newEventProducer.produce(data, tx);
}
```

3. **Add to module providers**:
```typescript
// transfer.module.ts
providers: [
  // ... existing providers
  NewEventProducer,
],
```

## Benefits

1. **Testability**: Each producer can be tested in isolation
2. **Maintainability**: Changes are localized to specific producers
3. **Extensibility**: New producers can be added without modifying existing code
4. **Readability**: Clear separation of concerns makes code easier to understand
5. **Type Safety**: Uses typed payloads from `@escrowly/kafka-core`

## Transactional Guarantee

All events are written to the `ledger_outbox` table **within the same database transaction** as the transfer, ensuring:

- ✅ **ACID Guarantee**: If transfer commits, events are guaranteed to be persisted
- ✅ **No Lost Events**: Events cannot be lost even if Kafka is temporarily unavailable
- ✅ **Reliable Publishing**: `OutboxProcessorService` automatically retries failed publishes

