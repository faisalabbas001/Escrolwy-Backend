# Ledger Service

The Ledger Service is the single financial authority for Escrowly, implementing double-entry accounting with validation-first transfers, immutable audit trails, and reliable Kafka event emission via outbox pattern.

## Features

- **Balance Validation**: Validates balance sufficiency before money moves
- **Double-Entry Accounting**: Records every transfer via immutable double-entry
- **Transfer Types**: Supports internal transfers (Escrowly → Escrowly) and external transfers (Escrowly → Blockchain)
- **Kafka Outbox**: Emits final financial facts via Kafka Outbox pattern for reliability
- **Immutable Audit Trail**: All money movements are recorded immutably

## Database Schema

The service uses the `ledger_db` schema with the following tables:

1. **accounts** - Balance buckets (spendable, reserved, treasury, fees)
2. **transfers** - Transfer intent (before journal creation)
3. **journals** - Why money moved (created after validation)
4. **entries** - How money moved (debits & credits)
5. **ledger_outbox** - Reliable Kafka emission

## API Endpoints

### Transfers

- `POST /v1/ledger/transfers` - Create transfer (main entry point)
- `GET /v1/ledger/transfers/:id` - Get transfer status

### Accounts

- `GET /v1/ledger/accounts/:id/balance` - Get account balance
- `GET /v1/ledger/users/:id/balances` - Get all user balances

## Kafka Topics

### Consumes

- `blockchain.tx_confirmed` - External transaction success
- `blockchain.tx_failed` - External transaction failed

### Produces (via Outbox)

- `ledger.transfer_posted` - Final accounting truth
- `ledger.balance_updated` - UI refresh
- `ledger.external_payout_created` - Blockchain worker trigger

## Setup

1. Install dependencies:
```bash
npm install
```

2. Generate Prisma client:
```bash
npm run prisma:generate
```

3. Run migrations:
```bash
npm run prisma:migrate:dev
```

4. Start the service:
```bash
npm run start:dev
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `KAFKA_BROKERS` - Kafka broker addresses (comma-separated)
- `KAFKA_ENABLED` - Enable/disable Kafka (true/false)
- `PORT` - Service port (default: 3005)
- `JWT_SECRET` - JWT secret for authentication

## Swagger Documentation

Once the service is running, Swagger documentation is available at:
```
http://localhost:3005/docs
```

