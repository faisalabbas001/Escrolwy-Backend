# Postman Collection - EscrowLedger Testing

Complete Postman collection for testing the Escrow-Ledger financial system.

## Setup

### 1. Import Collection

Import `EscrowLedger_Collection.json` into Postman.

### 2. Configure Environment Variables

The collection includes default variables, but you can override them:

- `auth_service_url`: http://localhost:3003
- `ledger_service_url`: http://localhost:3005
- `escrow_service_url`: http://localhost:3004
- `service_api_key`: Your service API key (default: "default-service-key-change-in-production")

### 3. Run Seed Scripts First

Before running tests, execute seed scripts:

1. **Auth Service Seed**: Run `0. Auth Service Seed > Seed Users`
2. **Ledger Service Seed**: Run `1. Ledger Seed > Seed User Accounts`

## Collection Structure

### 0. Auth Service Seed
- Seed Users
- Login as Buyer 1, Buyer 2, Seller 1, Seller 2, Broker 1, Admin
- Stores JWT tokens in collection variables

### 1. Ledger Seed
- Seed User Accounts
- Verify Buyer 1 Balance
- Verify Seller 1 Balance

### 2. Buyer Creates Escrow
- A1: Buyer Pays Full Fee
- A2: Fee Split 50/50
- A3: Seller Pays Full Fee
- Insufficient Balance (Should Fail)

### 3. Seller Creates Escrow
- B1: Seller Pays Full Fee
- B2: Buyer Pays Full Fee
- B3: Fee Split 50/50
- Insufficient Buyer Balance (Should Fail) - **CRITICAL TEST**
- Insufficient Seller Fee Balance (Should Fail)

### 4. Broker Creates Escrow
- Broker Creates with Fee Split

### 5. Happy Flow
Complete lifecycle:
1. Create Escrow
2. Record Payment
3. Verify Funds Reserved
4. Accept Escrow
5. Complete Escrow
6. Verify Funds Released

### 6. Dispute Flow
1. Create Escrow for Dispute
2. Record Payment
3. Raise Dispute
4. Admin Resolve - Refund Buyer

### 7. Internal Transfers (Service-to-Service)
- Spendable → Reserved
- Reserved → Escrow Holding
- Escrow Holding → Seller Spendable
- Escrow Holding → Buyer Spendable (Refund)
- Spendable → Platform Revenue
- Duplicate Idempotency Key (Should Fail)
- Insufficient Balance (Should Fail)

**Note**: These endpoints require `X-Service-Api-Key` header and are NOT accessible to regular users.

### 8. External Transfers
- Create External Transfer
- Simulate Callback Success
- Simulate Callback Failure
- Duplicate Callbacks (Should Fail)

### 9. Edge Cases
- Invalid Fee Split Percentages
- Concurrent Escrow Creation
- Balance Verification After Operations

## Test Assertions

Each request includes test assertions that verify:

- ✅ Status codes (200, 201, 400, 409, etc.)
- ✅ Response structure
- ✅ State transitions
- ✅ Balance changes
- ✅ Error messages
- ✅ Idempotency

## Running Tests

### Manual Testing

1. Run folders in order (0 → 1 → 2 → ...)
2. Each folder builds on previous results
3. Variables are automatically set by login requests

### Automated Testing

Use Postman's Collection Runner or Newman CLI:

```bash
# Install Newman
npm install -g newman

# Run collection
newman run EscrowLedger_Collection.json \
  --env-var "auth_service_url=http://localhost:3003" \
  --env-var "ledger_service_url=http://localhost:3005" \
  --env-var "escrow_service_url=http://localhost:3004" \
  --env-var "service_api_key=your-service-api-key"
```

## Critical Test Cases

### 1. Seller Creates Escrow - Buyer Balance Check

**CRITICAL**: When seller creates escrow, buyer balance MUST be checked for escrow_amount first.

Test: `3. Seller Creates Escrow > Insufficient Buyer Balance (Should Fail)`

- Buyer 2 has 90 balance
- Seller tries to create escrow for 200
- Should fail immediately with 400 Bad Request
- Error should mention buyer balance

### 2. Fee Validation

All fee payment scenarios are tested:
- Buyer pays full fee
- Seller pays full fee
- Fee split 50/50
- Insufficient balance scenarios

### 3. Internal Transfers

Verify that:
- Internal transfers require service API key
- Regular users cannot access internal endpoints
- Double-entry accounting maintained
- Idempotency enforced

## Troubleshooting

### Authentication Errors

- Ensure seed scripts ran successfully
- Check that login requests stored tokens
- Verify JWT tokens are valid

### Balance Mismatches

- Run seed scripts again to reset balances
- Check that previous tests didn't affect balances
- Verify double-entry accounting maintained

### Service API Key Errors

- Ensure `service_api_key` variable is set
- Check that internal endpoints use `X-Service-Api-Key` header
- Verify ServiceAuthGuard is configured correctly

## Related Documentation

- [Internal APIs Security](../../docs/INTERNAL_APIS_SECURITY.md)
- [Inter-Service Communication](../../docs/INTER_SERVICE_COMMUNICATION.md)
- [Escrow Kafka Integration](../src/kafka/README.md)

