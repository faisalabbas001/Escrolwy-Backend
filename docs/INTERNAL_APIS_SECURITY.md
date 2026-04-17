# Internal APIs Security

## Overview

Internal APIs are **service-to-service only** endpoints that are NOT accessible to:
- Public users
- Authenticated end users (even with valid JWT tokens)
- Any client application

These APIs are designed for **inter-service communication** where one service depends on another service's response.

## Authentication Mechanism

Internal APIs use **Service API Key** authentication via HTTP header:

```
X-Service-Api-Key: <service-api-key>
X-Service-Id: <service-name>
```

## Protected Endpoints

The following endpoints are marked as `@ServiceOnly()` and require service API key:

### Ledger Service Internal APIs

**Note**: Most inter-service communication uses Kafka events (fire-and-forget).
REST APIs are ONLY used when a service needs an immediate synchronous response.

1. **POST /v1/ledger/users/:id/balance-check**
   - Checks user balance sufficiency
   - Used by: Escrow Service for fee validation before creating escrow
   - **Why REST?**: Escrow needs immediate response to fail fast if balance insufficient
   - **NOT accessible to users**

### Other Internal Endpoints (Available but Not Used by Escrow)

The following endpoints exist but are **NOT used by Escrow service**.
Escrow service uses Kafka events for these operations instead:

- `POST /v1/ledger/internal/transfer` - Handled via Kafka events
- `POST /v1/ledger/reservations` - Handled via Kafka events (`escrow.payment.completed`)
- `POST /v1/ledger/reservations/:id/release` - Handled via Kafka events (`escrow.completed`)
- `POST /v1/ledger/reservations/:id/cancel` - Handled via Kafka events (`escrow.cancelled`)

**See**: [Inter-Service Communication](./INTER_SERVICE_COMMUNICATION.md) for details.

## Public/User-Accessible Endpoints

The following endpoints remain accessible to authenticated users:

- `GET /v1/ledger/accounts/:id/balance` - Get account balance
- `GET /v1/ledger/users/:id/balances` - Get all user balances
- `POST /v1/ledger/transfers` - Create user transfers (internal/external)
- `GET /v1/ledger/transfers/:id` - Get transfer details

## Implementation

### ServiceAuthGuard

The `ServiceAuthGuard` validates service API keys:

1. Checks if endpoint is marked with `@ServiceOnly()`
2. Extracts `X-Service-Api-Key` header
3. Validates against `SERVICE_API_KEY` environment variable
4. Rejects requests without valid API key

### Usage in Controllers

```typescript
import { ServiceOnly } from '@escrowly/auth-common';

@Controller('ledger/internal/transfer')
export class InternalTransferController {
  @ServiceOnly() // Marks endpoint as internal-only
  @Post()
  async createInternalTransfer(@Body() dto: CreateInternalTransferDto) {
    // Only accessible with service API key
  }
}
```

### Usage in Client Services

```typescript
// LedgerClientService automatically includes service API key
const response = await this.ledgerClient.createReservation({
  userId: '...',
  amount: 100,
  reference: 'escrow-123',
});
```

## Environment Configuration

Set `SERVICE_API_KEY` in environment variables:

```env
SERVICE_API_KEY=your-secure-service-api-key-here
```

**Important**: Use different API keys for different environments (dev, stage, prod).

## Security Best Practices

1. ✅ **Never expose internal endpoints to public**
2. ✅ **Use strong, randomly generated API keys**
3. ✅ **Rotate API keys regularly**
4. ✅ **Use different keys per environment**
5. ✅ **Monitor API key usage**
6. ✅ **Log all internal API access**
7. ✅ **Use HTTPS in production**

## Testing

To test internal APIs, include the service API key header:

```bash
curl -X POST http://localhost:3005/v1/ledger/reservations \
  -H "Content-Type: application/json" \
  -H "X-Service-Api-Key: your-service-api-key" \
  -H "X-Service-Id: escrow-service" \
  -d '{
    "userId": "11111111-1111-4111-8111-111111111111",
    "amount": 100,
    "reference": "test-escrow"
  }'
```

## Verification Checklist

- [x] Internal endpoints marked with `@ServiceOnly()`
- [x] ServiceAuthGuard registered globally
- [x] LedgerClientService includes API key in requests
- [x] Public endpoints remain accessible to users
- [x] Service API key configured in environment
- [x] Documentation updated

