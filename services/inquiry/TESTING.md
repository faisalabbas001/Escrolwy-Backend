# Testing the Inquiry Service

This guide covers how to test the Inquiry Service with the new Kafka Outbox pattern implementation.

## Prerequisites

### 1. Start Infrastructure Services

```bash
# From the project root

# Start PostgreSQL
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
docker-compose logs -f postgres
# Look for: "database system is ready to accept connections"

# (Optional) Start Kafka/Redpanda for full Kafka testing
docker-compose --profile dev up -d redpanda kafka-ui
```

### 2. Setup Environment

```bash
cd services/inquiry

# Create .env file (if not exists)
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://escrowly_dev:escrowly_dev_password@localhost:5433/escrowly?schema=inquiry_db

# Service
PORT=3003
SERVICE_NAME=inquiry-service
NODE_ENV=development

# Kafka (set to true to test with Kafka)
KAFKA_ENABLED=false
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=inquiry-service
KAFKA_GROUP_ID=inquiry-consumer-group

# AWS (for secrets, can be empty in dev)
AWS_REGION=us-east-1
EOF
```

### 3. Install Dependencies & Generate Prisma Client

```bash
# From services/inquiry directory
npm install

# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy
```

### 4. Start the Inquiry Service

```bash
# Development mode with hot reload
npm run start:dev

# OR production mode
npm run build && npm run start:prod
```

## Testing Methods

### Method 1: Automated Test Script

```bash
# From project root
node scripts/test-inquiry.js
```

This script will:
- ✅ Health check
- ✅ Create inquiry
- ✅ Add messages
- ✅ Add attachments
- ✅ Admin operations
- ✅ Error handling

### Method 2: Swagger UI (Interactive)

1. Start the service: `npm run start:dev`
2. Open browser: http://localhost:3003/api/docs
3. Test each endpoint interactively

### Method 3: cURL Commands

#### Health Check
```bash
curl http://localhost:3003/api/v1/health
```

#### Create Inquiry
```bash
curl -X POST http://localhost:3003/api/v1/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "escrow_id": "escrow-test-123",
    "created_by": "user-test-456",
    "initial_message": "I have a question about my escrow"
  }'
```

#### Get Inquiry
```bash
curl http://localhost:3003/api/v1/inquiries/{INQUIRY_ID}
```

#### Add Message
```bash
curl -X POST http://localhost:3003/api/v1/inquiries/{INQUIRY_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "user-seller-789",
    "sender_role": "seller",
    "message": "I can help you with that question"
  }'
```

#### Admin - List Inquiries
```bash
curl "http://localhost:3003/api/v1/inquiries/admin/inquiries?page=1&limit=10"
```

#### Admin - Assign Inquiry
```bash
curl -X POST http://localhost:3003/api/v1/inquiries/admin/inquiries/{INQUIRY_ID}/assign \
  -H "Content-Type: application/json" \
  -d '{
    "admin_id": "admin-123"
  }'
```

#### Admin - Resolve Inquiry
```bash
curl -X POST http://localhost:3003/api/v1/inquiries/admin/inquiries/{INQUIRY_ID}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "status": "closed",
    "resolution_note": "Issue resolved successfully"
  }'
```

## Verifying Outbox Events

### Check Database

```bash
# Connect to PostgreSQL
psql -h localhost -p 5433 -U escrowly_dev -d escrowly

# List all outbox events
SELECT id, topic, status, "retryCount", "createdAt", "publishedAt" 
FROM inquiry_db.outbox_events 
ORDER BY "createdAt" DESC;

# Check pending events
SELECT * FROM inquiry_db.outbox_events WHERE status = 'pending';

# Check failed events
SELECT * FROM inquiry_db.outbox_events WHERE status = 'failed';
```

### Check Kafka (if enabled)

1. Open Kafka UI: http://localhost:8080
2. Navigate to Topics
3. Look for these topics:
   - `inquiry.created`
   - `inquiry.closed`
   - `inquiry.resolved`
   - `inquiry.assigned`
   - `inquiry.message.added`
   - `inquiry.attachment.uploaded`

## Testing Kafka Integration

### Enable Kafka

```bash
# Update .env
KAFKA_ENABLED=true

# Start Redpanda
docker-compose --profile dev up -d redpanda kafka-ui

# Restart the inquiry service
npm run start:dev
```

### Verify Events are Published

1. Create an inquiry via the API
2. Check Kafka UI at http://localhost:8080
3. Navigate to the `inquiry.created` topic
4. You should see the event with:
   - `metadata.eventType`: "inquiry.created"
   - `payload`: inquiry details

### Test Kafka Failure Recovery

1. Stop Kafka: `docker-compose stop redpanda`
2. Create an inquiry (will be saved to outbox)
3. Check database: Event should have `status = 'pending'`
4. Start Kafka: `docker-compose --profile dev up -d redpanda`
5. Wait 2-5 seconds (polling interval)
6. Check database: Event should have `status = 'published'`

## Unit Testing (Optional)

Create unit tests in `src/inquiry/__tests__/`:

```typescript
// inquiry.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { InquiryService } from '../inquiry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InquiryEventProducer } from '../../kafka';

describe('InquiryService', () => {
  let service: InquiryService;
  let prismaService: PrismaService;
  let eventProducer: InquiryEventProducer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InquiryService,
        {
          provide: PrismaService,
          useValue: {
            inquiries: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn((fn) => fn({
              inquiries: { create: jest.fn(), update: jest.fn() },
              inquiry_messages: { create: jest.fn() },
            })),
          },
        },
        {
          provide: InquiryEventProducer,
          useValue: {
            inquiryCreated: jest.fn(),
            inquiryClosed: jest.fn(),
            messageAdded: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InquiryService>(InquiryService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventProducer = module.get<InquiryEventProducer>(InquiryEventProducer);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more tests...
});
```

## Troubleshooting

### Service won't start

```bash
# Check logs
npm run start:dev 2>&1 | head -100

# Verify database connection
psql -h localhost -p 5433 -U escrowly_dev -d escrowly -c "SELECT 1"

# Regenerate Prisma client
npx prisma generate
```

### Events not publishing to Kafka

1. Verify `KAFKA_ENABLED=true` in `.env`
2. Check Kafka is running: `docker-compose ps redpanda`
3. Check broker address: `KAFKA_BROKERS=localhost:9092`
4. Check service logs for Kafka connection errors

### Outbox events stuck in 'pending'

1. Check if Kafka is enabled and running
2. Check for errors in the service logs
3. Verify the outbox publisher is running (check for log messages)

## Expected Test Output

```
🚀 Inquiry Service Tests

============================================================
Testing the Inquiry Service with new Kafka Outbox Pattern
...
============================================================

📝 Test: Health check
✅ Inquiry service is healthy
   Service: inquiry-service
   Status: ok

📝 Test: Create inquiry
✅ Inquiry created successfully
   Inquiry ID: abc123...
   Escrow ID: escrow-test-123...
   Status: open

📝 Test: Add message to inquiry
✅ Message added successfully
   Message ID: def456...

... more tests ...

============================================================
🏁 Inquiry Service Tests completed!
```
