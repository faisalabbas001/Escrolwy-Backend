# Ledger Service - Kafka Consumer

This module handles Kafka event consumption for the Ledger service using `@escrowly/kafka-core`.

## Architecture

The Kafka consumer follows **SOLID principles** and **flat code practices**:

### File Structure (Flat)

```
services/ledger/src/kafka/
├── index.ts                              # Exports
├── ledger.consumer.ts                    # Main orchestrator
├── ledger-outbox.adapter.ts              # Outbox adapter for publishing
├── handlers/                             # Event handlers (SRP)
│   ├── index.ts
│   ├── event-handler.interface.ts        # Handler interface (DIP)
│   ├── transaction-confirmed.handler.ts  # TRANSACTION_CONFIRMED handler
│   └── transaction-failed.handler.ts     # TRANSACTION_FAILED handler
├── validators/                           # Validation logic (SRP)
│   ├── index.ts
│   └── event-validator.service.ts         # Event schema validation
└── services/                             # Utility services (SRP)
    ├── index.ts
    └── transfer-id-extractor.service.ts   # Transfer ID extraction
```

## SOLID Principles Applied

### 1. Single Responsibility Principle (SRP)

Each class has a single, well-defined responsibility:

- **`LedgerConsumer`**: Orchestrates event subscriptions
- **`TransactionConfirmedHandler`**: Handles TRANSACTION_CONFIRMED events
- **`TransactionFailedHandler`**: Handles TRANSACTION_FAILED events
- **`EventValidatorService`**: Validates event schemas
- **`TransferIdExtractorService`**: Extracts transfer IDs from transaction IDs

### 2. Open/Closed Principle (OCP)

- New event handlers can be added without modifying existing code
- Handlers implement `IEventHandler` interface, allowing extension
- New validation rules can be added to `EventValidatorService` without changing handlers

### 3. Liskov Substitution Principle (LSP)

- All handlers implement `IEventHandler` interface
- Any handler implementation can be substituted without breaking the consumer

### 4. Interface Segregation Principle (ISP)

- `IEventHandler` interface is focused - only contains `handle()` method
- No "fat" interfaces forcing unnecessary dependencies

### 5. Dependency Inversion Principle (DIP)

- `LedgerConsumer` depends on handler interfaces, not concrete implementations
- Handlers depend on service interfaces (via dependency injection)
- Easy to mock for testing

## Event Handlers

### Transaction Confirmed Handler

Handles `LedgerTopics.TRANSACTION_CONFIRMED` events:

1. Validates event schema
2. Extracts transfer ID from transaction ID
3. Updates transfer status to `completed`

### Transaction Failed Handler

Handles `LedgerTopics.TRANSACTION_FAILED` events:

1. Validates event schema
2. Extracts transfer ID from transaction ID
3. Updates transfer status to `failed` with reason

## Usage

The consumer is automatically initialized when the application starts:

```typescript
// app.module.ts
@Module({
  providers: [
    LedgerConsumer,
    TransactionConfirmedHandler,
    TransactionFailedHandler,
    EventValidatorService,
    TransferIdExtractorService,
  ],
})
export class AppModule {}
```

## Adding New Event Handlers

To add a new event handler:

1. **Create handler class**:
```typescript
// handlers/new-event.handler.ts
@Injectable()
export class NewEventHandler implements IEventHandler<NewEventPayload> {
  constructor(
    private readonly validator: EventValidatorService,
    // ... other dependencies
  ) {}

  async handle(event: BaseEvent<NewEventPayload>): Promise<void> {
    if (!this.validator.validate(event, 'NEW_EVENT')) {
      return;
    }
    // Handle event
  }
}
```

2. **Register in consumer**:
```typescript
// ledger.consumer.ts
constructor(
  private readonly kafka: KafkaService,
  private readonly newEventHandler: NewEventHandler,
) {}

async onModuleInit() {
  this.kafka.subscribe(
    LedgerTopics.NEW_EVENT,
    this.newEventHandler.handle.bind(this.newEventHandler),
  );
}
```

3. **Add to module providers**:
```typescript
// app.module.ts
providers: [
  // ... existing providers
  NewEventHandler,
],
```

## Benefits

1. **Testability**: Each component can be tested in isolation
2. **Maintainability**: Changes are localized to specific handlers
3. **Extensibility**: New handlers can be added without modifying existing code
4. **Readability**: Clear separation of concerns makes code easier to understand
5. **Type Safety**: Uses typed payloads from `@escrowly/kafka-core`

## Error Handling

- Event validation failures are logged and skipped (non-blocking)
- Handler errors are thrown to trigger Kafka retry mechanism
- Transfer update failures are logged with context for debugging

