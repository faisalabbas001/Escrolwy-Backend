# Notification Service - Flow-Based Testing Guide

Complete testing guide for validating the Notification Service end-to-end. This guide helps you verify that all components (REST APIs, Kafka consumption, Kafka production, and database) work together correctly.

---

## 📋 Prerequisites

### 1. Service Running

```bash
# Start Notification Service
cd services/notification
npm run start:dev

# Service runs on: http://localhost:3005
# Swagger docs: http://localhost:3005/api/docs
```

### 2. Environment Variables

Ensure `.env` has:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5433/escrowly?schema=notification_db

# Kafka (optional for testing)
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:19092

# Resend (for email sending)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=notifications@escrowly.com  # Must be verified in Resend Dashboard
```

### 3. Kafka Running (for event testing)

```bash
# Start Kafka (if testing event consumption)
docker-compose up -d kafka
```

---

## 🧪 Testing Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TESTING FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Template Management (REST API)                          │
│     └─> Register templates in database                      │
│                                                              │
│  2. User Preferences (REST API)                             │
│     └─> Configure notification settings                     │
│                                                              │
│  3. Kafka Event Consumption                                 │
│     └─> Service consumes events from Kafka                  │
│     └─> Processes notifications                             │
│                                                              │
│  4. Kafka Event Production                                  │
│     └─> Service emits notification.sent/failed events      │
│                                                              │
│  5. Database State Verification                             │
│     └─> Check notification_logs, outbox_events, etc.        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Flow 1: Template Management (REST API)

### Step 1.1: List Templates

```bash
curl -X GET http://localhost:3005/api/v1/admin/templates
```

**Expected Response:**
```json
{
  "data": [],
  "total": 0
}
```

### Step 1.2: Register a Template

**Important:** Template must exist in Resend Dashboard first with matching `templateId`.

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "escrow_created_v1",
    "name": "Escrow Created",
    "description": "Email sent when escrow is created",
    "subject": "New Escrow Created: {{escrowId}}",
    "html": "<h1>New Escrow</h1><p>Escrow ID: {{escrowId}}</p><p>Amount: {{amount}} {{asset}}</p>",
    "variables": "[\"escrowId\", \"amount\", \"asset\", \"escrowUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Expected Response (201):**
```json
{
  "id": "uuid-here",
  "templateId": "escrow_created_v1",
  "name": "Escrow Created",
  "subject": "New Escrow Created: {{escrowId}}",
  "html": "<h1>New Escrow</h1>...",
  "variables": "[\"escrowId\", \"amount\", \"asset\", \"escrowUrl\"]",
  "isActive": true,
  "version": "v1",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Database Check:**
```sql
SELECT * FROM notification_db.email_templates WHERE template_id = 'escrow_created_v1';
-- Should show 1 row
```

### Step 1.3: Get Template

```bash
curl -X GET http://localhost:3005/api/v1/admin/templates/escrow_created_v1
```

### Step 1.4: Update Template

```bash
curl -X PUT http://localhost:3005/api/v1/admin/templates/escrow_created_v1 \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Updated: New Escrow Created: {{escrowId}}",
    "html": "<h1>Updated Template</h1><p>{{escrowId}}</p>"
  }'
```

**Database Check:**
```sql
SELECT updated_at FROM notification_db.email_templates WHERE template_id = 'escrow_created_v1';
-- updated_at should be newer
```

---

## 👤 Flow 2: User Preferences (REST API)

### Step 2.1: Get User Settings

```bash
curl -X GET "http://localhost:3005/api/v1/notifications/settings?userId=user-123"
```

**Expected Response (200):**
```json
{
  "userId": "user-123",
  "preferences": {
    "transaction_events": true,
    "account_events": true,
    "milestone_events": true,
    "marketing_emails": false
  }
}
```

**Database Check:**
```sql
SELECT * FROM notification_db.user_notification_settings WHERE user_id = 'user-123';
-- May be null (returns defaults) or shows user settings
```

### Step 2.2: Update User Settings

```bash
curl -X PUT http://localhost:3005/api/v1/notifications/settings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "preferences": {
      "transaction_events": true,
      "account_events": false,
      "milestone_events": true,
      "marketing_emails": false
    }
  }'
```

**Expected Response (200):** Same structure as GET

**Database Check:**
```sql
SELECT * FROM notification_db.user_notification_settings WHERE user_id = 'user-123';
-- Should show updated preferences
```

### Step 2.3: Admin - Get User Settings

```bash
curl -X GET http://localhost:3005/api/v1/notifications/settings/user-123
```

### Step 2.4: Admin - Update User Settings

```bash
curl -X PUT http://localhost:3005/api/v1/notifications/settings/user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": {
      "transaction_events": false,
      "account_events": true,
      "milestone_events": false,
      "marketing_emails": true
    }
  }'
```

---

## 📧 Flow 3: Test Email Sending (REST API)

### Step 3.1: Send Test Email

```bash
curl -X POST http://localhost:3005/api/v1/notifications/test-send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email from Notification Service",
    "html": "<h1>Test</h1><p>This is a test email.</p>"
  }'
```

**Expected Response (200):**
```json
{
  "success": true,
  "resendId": "re_abc123",
  "from": "notifications@escrowly.com",
  "to": "your-email@example.com",
  "message": "Test email sent successfully",
  "troubleshooting": {
    "checkSpam": "Check your spam/junk folder - 90% of 'missing' emails are there!",
    "verifyFromEmail": "Ensure 'notifications@escrowly.com' is verified in Resend Dashboard",
    "checkResendDashboard": "Check delivery status: https://resend.com/emails"
  }
}
```

**Note:** This bypasses Kafka and sends directly via Resend. Use for testing email delivery only.

---

## 🔄 Flow 4: Kafka Event Consumption

### Step 4.1: Enable Kafka Consumer

Ensure `KAFKA_ENABLED=true` in `.env` and restart service.

**Check Logs:**
```
📥 Notification Consumer started
Subscribed to escrow events
Subscribed to inquiry events
Subscribed to auth events
```

### Step 4.2: Publish Test Event to Kafka

Use the test scripts or publish manually:

```bash
# Using test script
node test-escrow-completed-event.js

# Or publish manually (requires Kafka producer)
```

**Example Event (escrow.completed):**
```json
{
  "metadata": {
    "eventId": "event-123",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "eventType": "escrow.completed",
    "source": "escrow-service",
    "version": "1.0"
  },
  "payload": {
    "escrowId": "escrow-123",
    "buyerId": "buyer-123",
    "sellerId": "seller-123",
    "amount": 1000,
    "asset": "USDT",
    "platformFee": 10,
    "completedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Step 4.3: Verify Event Processing

**Service Logs:**
```
Processing event event-123 of type escrow.completed
Successfully processed event event-123, sent 1 email(s)
```

**Database Check - Processed Events:**
```sql
SELECT * FROM notification_db.processed_events 
WHERE event_key = 'event-123';
-- Should show 1 row with processed_at timestamp
```

**Database Check - Notification Logs:**
```sql
SELECT id, user_id, event_type, event_key, template_id, 
       recipient_email, subject, status, resend_id, created_at
FROM notification_db.notification_logs 
WHERE event_key = 'event-123'
ORDER BY created_at DESC;
-- Should show notification log entry
```

**Expected Log Entry:**
- `event_type`: `escrow.completed`
- `event_key`: `event-123`
- `template_id`: `escrow_completed_v1` (or mapped template)
- `status`: `sent` or `failed`
- `user_id`: `seller-123` (seller gets notified)

---

## 📤 Flow 5: Kafka Event Production

The service emits events when notifications are sent or fail.

### Step 5.1: Verify Outbox Events

After processing a notification, check the outbox:

```sql
SELECT id, topic, partition_key, status, payload, 
       retry_count, created_at, published_at
FROM notification_db.outbox_events 
WHERE topic IN ('notification.email.sent', 'notification.email.failed')
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Events:**

1. **Success Case:**
   - `topic`: `notification.email.sent`
   - `status`: `pending` (will be `published` by outbox processor)
   - `payload`: Contains `NotificationSentPayload`

2. **Failure Case:**
   - `topic`: `notification.email.failed`
   - `status`: `pending`
   - `payload`: Contains `NotificationDeliveryFailedPayload`

### Step 5.2: Verify Event Payload Structure

**Success Event Payload:**
```json
{
  "notificationId": "uuid",
  "userId": "seller-123",
  "eventType": "escrow.completed",
  "eventKey": "event-123",
  "templateId": "escrow_completed_v1",
  "recipientEmail": "seller@example.com",
  "subject": "Escrow Completed",
  "resendId": "re_abc123",
  "sentAt": "2025-01-01T00:00:00.000Z"
}
```

**Failure Event Payload:**
```json
{
  "notificationId": "uuid",
  "userId": "seller-123",
  "eventType": "escrow.completed",
  "eventKey": "event-123",
  "templateId": "escrow_completed_v1",
  "recipientEmail": "seller@example.com",
  "subject": "Escrow Completed",
  "errorMessage": "Failed to send email: ...",
  "failedAt": "2025-01-01T00:00:00.000Z",
  "retryCount": 0
}
```

### Step 5.3: Verify Events Published to Kafka

**Check Kafka Topics:**
```bash
# If using Kafka UI: http://localhost:8080
# Navigate to Topics → notification.email.sent
# Navigate to Topics → notification.email.failed
```

**Or use Kafka CLI:**
```bash
docker-compose exec kafka kafka-console-consumer \
  --bootstrap-server localhost:19092 \
  --topic notification.email.sent \
  --from-beginning
```

---

## 🔍 Flow 6: Admin Endpoints

### Step 6.1: Query Notification Logs

```bash
curl -X GET "http://localhost:3005/api/v1/notifications/admin/logs?limit=10&page=1"
```

**With Filters:**
```bash
# By event key
curl -X GET "http://localhost:3005/api/v1/notifications/admin/logs?eventKey=event-123"

# By user ID
curl -X GET "http://localhost:3005/api/v1/notifications/admin/logs?userId=seller-123"

# By status
curl -X GET "http://localhost:3005/api/v1/notifications/admin/logs?status=failed"

# By event type
curl -X GET "http://localhost:3005/api/v1/notifications/admin/logs?eventType=escrow.completed"
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "seller-123",
      "eventType": "escrow.completed",
      "eventKey": "event-123",
      "templateId": "escrow_completed_v1",
      "recipientEmail": "seller@example.com",
      "subject": "Escrow Completed",
      "status": "sent",
      "resendId": "re_abc123",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

### Step 6.2: Get User Notification History

```bash
curl -X GET http://localhost:3005/api/v1/notifications/user/user-123
```

### Step 6.3: Retry Failed Notification

```bash
# First, find a failed notification ID
curl -X GET "http://localhost:3005/api/v1/notifications/admin/logs?status=failed"

# Then retry it
curl -X POST http://localhost:3005/api/v1/notifications/retry/{notificationId}
```

**Expected Response (200):**
```json
{
  "success": true,
  "resendId": "re_new_id",
  "message": "Notification retried successfully"
}
```

**Database Check:**
```sql
SELECT status, resend_id, error_message 
FROM notification_db.notification_logs 
WHERE id = '{notificationId}';
-- status should be 'sent', resend_id updated, error_message null
```

---

## 🎯 End-to-End Test Flow

### Complete Flow: Escrow Completed → Email Sent

**Step 1:** Register template (if not exists)
```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "escrow_completed_v1",
    "name": "Escrow Completed",
    "subject": "Escrow Completed: {{escrowId}}",
    "html": "<h1>Escrow Completed</h1><p>Amount: {{amount}} {{asset}}</p>",
    "variables": "[\"escrowId\", \"amount\", \"asset\"]"
  }'
```

**Step 2:** Set user preferences (optional - defaults allow all)
```bash
curl -X PUT http://localhost:3005/api/v1/notifications/settings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "seller-123",
    "preferences": {
      "transaction_events": true,
      "account_events": true,
      "milestone_events": true,
      "marketing_emails": false
    }
  }'
```

**Step 3:** Publish escrow.completed event to Kafka
```bash
# Use test script or publish via Kafka producer
node test-escrow-completed-event.js
```

**Step 4:** Verify processing (wait 2-5 seconds)

**Check Service Logs:**
```
Processing event event-123 of type escrow.completed
Successfully processed event event-123, sent 1 email(s)
```

**Check Database:**
```sql
-- Processed event
SELECT * FROM notification_db.processed_events WHERE event_key = 'event-123';

-- Notification log
SELECT * FROM notification_db.notification_logs WHERE event_key = 'event-123';

-- Outbox event
SELECT * FROM notification_db.outbox_events 
WHERE payload::text LIKE '%event-123%' 
ORDER BY created_at DESC LIMIT 1;
```

**Step 5:** Verify Kafka event published
```bash
# Check Kafka topic
# Topic: notification.email.sent
# Should contain event with notification details
```

**Step 6:** Verify email sent
- Check Resend Dashboard: https://resend.com/emails
- Search by `resendId` from notification log
- Status should be "Delivered" (check spam if not in inbox)

---

## ✅ Production Readiness Checklist

### API Endpoints
- [ ] Template CRUD works (POST, GET, PUT, DELETE)
- [ ] User preferences work (GET, PUT)
- [ ] Admin endpoints work (logs, retry, test-send)
- [ ] All endpoints return correct status codes
- [ ] Error handling works (400, 404, 409, etc.)

### Kafka Consumption
- [ ] Consumer starts when `KAFKA_ENABLED=true`
- [ ] Consumes events from subscribed topics
- [ ] Processes events correctly
- [ ] Marks events as processed in `processed_events`
- [ ] Handles failures gracefully (logs, doesn't crash)

### Kafka Production
- [ ] Emits `notification.email.sent` on success
- [ ] Emits `notification.email.failed` on failure
- [ ] Events saved to `outbox_events` table
- [ ] Outbox processor publishes events to Kafka
- [ ] Event payloads match schema

### Database
- [ ] Templates stored in `email_templates`
- [ ] User preferences stored in `user_notification_settings`
- [ ] Notification logs in `notification_logs`
- [ ] Processed events in `processed_events`
- [ ] Outbox events in `outbox_events`
- [ ] All tables use correct schema (`notification_db`)

### Email Delivery
- [ ] Emails sent via Resend
- [ ] Resend ID stored in logs
- [ ] Failed emails logged with error message
- [ ] Retry endpoint works for failed notifications

### Error Handling
- [ ] Template rendering errors handled
- [ ] Email sending errors handled
- [ ] Database errors handled
- [ ] Kafka errors handled (consumer, producer)
- [ ] All errors logged appropriately

### Idempotency
- [ ] Duplicate events not processed twice
- [ ] `processed_events` prevents reprocessing
- [ ] Same `eventKey` only processed once

### User Preferences
- [ ] Opted-out users don't receive emails
- [ ] Preferences checked before sending
- [ ] Skipped emails logged correctly

---

## 🐛 Troubleshooting

### Issue: Kafka events not consumed

**Check:**
1. `KAFKA_ENABLED=true` in `.env`
2. Service logs show "📥 Notification Consumer started"
3. Kafka is running: `docker-compose ps kafka`
4. Topics exist: Check Kafka UI or CLI

**Fix:**
```bash
# Enable Kafka
echo "KAFKA_ENABLED=true" >> services/notification/.env

# Restart service
npm run notification:dev
```

### Issue: Emails not arriving

**Check:**
1. Resend Dashboard shows "Delivered" status
2. Check spam folder
3. From email verified in Resend Dashboard
4. Domain verified in Resend Dashboard

**Fix:**
- See `DOMAIN_VERIFIED_BUT_EMAILS_NOT_ARRIVING.md`

### Issue: Events not published to Kafka

**Check:**
1. Outbox events in database: `SELECT * FROM notification_db.outbox_events WHERE status = 'pending'`
2. Outbox processor running (check logs)
3. Kafka connection working

**Fix:**
- Check outbox processor logs
- Verify Kafka connection
- Check `outbox_events` table for errors

### Issue: Database errors

**Check:**
1. Database connection: `DATABASE_URL` correct
2. Schema exists: `notification_db`
3. Migrations applied: `npm run notification:prisma:migrate`

**Fix:**
```bash
# Run migrations
npm run notification:prisma:migrate

# Generate Prisma client
npm run notification:prisma:generate
```

---

## 📊 Quick Verification Commands

```bash
# Check service health
curl http://localhost:3005/api/v1/health

# List templates
curl http://localhost:3005/api/v1/admin/templates

# Get user settings
curl "http://localhost:3005/api/v1/notifications/settings?userId=user-123"

# Query logs
curl "http://localhost:3005/api/v1/notifications/admin/logs?limit=5"

# Send test email
curl -X POST http://localhost:3005/api/v1/notifications/test-send \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'
```

---

## 🎉 Conclusion

If all flows pass:

✅ **Notification Service is production-ready!**

The service:
- ✅ Manages templates via REST API
- ✅ Handles user preferences
- ✅ Consumes Kafka events reliably
- ✅ Produces Kafka events (sent/failed)
- ✅ Stores all state in database
- ✅ Sends emails via Resend
- ✅ Handles errors gracefully
- ✅ Provides admin tools for monitoring

**Next Steps:**
- Re-enable authentication guards (uncomment in `main.ts` and controllers)
- Set `KAFKA_ENABLED=true` in production
- Configure proper `RESEND_FROM_EMAIL`
- Monitor logs and outbox events
- Move to next service! 🚀

