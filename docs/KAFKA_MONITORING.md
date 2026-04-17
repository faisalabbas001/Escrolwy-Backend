# Kafka Monitoring & UI Guide

This guide shows you how to monitor Kafka events in your Escrowly platform - similar to Bull Board for BullMQ.

## 🚀 Quick Start

### 1. Start Kafka UI

```bash
# Start all dev services (including Kafka UI)
docker-compose --profile dev up -d

# Or start only Kafka services
docker-compose up -d redpanda kafka-ui
```

### 2. Access Kafka UI

Open your browser: **http://localhost:8080**

## 📊 What You Can Monitor

### 1. **Topics** (Event Channels)
- `escrow.created`
- `escrow.payment.completed`
- `escrow.completed`
- `escrow.disputed`
- `auth.user.created`
- `ledger.balance.reserved`
- And more...

### 2. **Messages** (Events)
View individual events with:
- ✅ Event ID (for idempotency)
- ✅ Timestamp
- ✅ Source service
- ✅ Full payload
- ✅ Headers

### 3. **Consumer Groups**
Monitor which services are consuming events:
- `escrow-consumer-group`
- `ledger-consumer-group`
- `notification-consumer-group`

### 4. **Lag Monitoring**
See if consumers are falling behind producers

## 🎯 Key Features

### Browse Topics

1. Go to **Topics** tab
2. Click on any topic (e.g., `escrow.payment.completed`)
3. View all messages in that topic

### View Message Details

```json
{
  "metadata": {
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-12-12T18:30:00.000Z",
    "eventType": "escrow.payment.completed",
    "source": "escrow-service",
    "version": "1.0.0"
  },
  "payload": {
    "escrowId": "esc-123",
    "buyerId": "usr-456",
    "sellerId": "usr-789",
    "amount": 1000.00,
    "asset": "USDT",
    "ledgerAction": "reserve_funds"
  }
}
```

### Monitor Consumer Lag

**Consumer Groups** tab shows:
- Which services are consuming
- Current offset vs latest offset
- Lag (how many messages behind)

```
Consumer Group: ledger-consumer-group
Topic: escrow.payment.completed
Current Offset: 1,234
Latest Offset: 1,235
Lag: 1 message
```

### Search & Filter

- **By Key**: Search by partition key (e.g., escrowId)
- **By Timestamp**: Find events in a time range
- **By Offset**: Jump to specific message

## 📋 Kafka UI Features Matrix

| Feature | Available | Description |
|---------|-----------|-------------|
| **View Topics** | ✅ | See all Kafka topics |
| **Browse Messages** | ✅ | View individual events |
| **Search Messages** | ✅ | Find by key, timestamp, offset |
| **Consumer Groups** | ✅ | Monitor consumers & lag |
| **Create Topics** | ✅ | Manually create topics |
| **Delete Messages** | ✅ | Clean up test data |
| **Produce Messages** | ✅ | Send test events |
| **View Schemas** | ✅ | See event schemas |
| **Live Tail** | ✅ | Real-time event stream |

## 🔍 Common Monitoring Tasks

### Check if Events Are Being Produced

1. Go to **Topics** → Select topic
2. Check **Messages** count
3. Look at **Last Updated** timestamp

**Healthy**: Messages increasing, timestamp recent
**Issue**: No new messages, old timestamp

### Check if Events Are Being Consumed

1. Go to **Consumer Groups**
2. Find your consumer (e.g., `ledger-consumer-group`)
3. Check **Lag**

**Healthy**: Lag = 0 or very low
**Issue**: Lag increasing (consumer falling behind)

### Debug a Specific Event

1. Go to **Topics** → Select topic
2. Use **Search** with:
   - Partition key (escrowId)
   - Timestamp range
3. Click event to see full payload

### Test Event Production

1. Go to **Topics** → Select topic
2. Click **Produce Message**
3. Paste JSON:

```json
{
  "metadata": {
    "eventId": "test-event-001",
    "timestamp": "2025-12-12T18:30:00.000Z",
    "eventType": "escrow.test",
    "source": "manual-test",
    "version": "1.0.0"
  },
  "payload": {
    "message": "Test event"
  }
}
```

## 📊 Service-Specific Monitoring

### Escrow Service (Producer)

**Monitor**:
- Total events produced: Check message count per topic
- Recent events: Tail `escrow.*` topics
- Event rate: Messages per minute

**Troubleshooting**:
```bash
# Check if escrow service is producing
curl http://localhost:3004/health

# View recent escrow events
# In Kafka UI: Topics → escrow.created → Sort by timestamp DESC
```

### Ledger Service (Consumer)

**Monitor**:
- Consumer lag: `ledger-consumer-group` lag
- Processing rate: Offset increase rate
- Failed messages: DLQ (Dead Letter Queue) topics

**Troubleshooting**:
```bash
# Check if ledger service is consuming
curl http://localhost:3005/health

# In Kafka UI: Consumer Groups → ledger-consumer-group
```

## 🛠️ Advanced Features

### 1. Live Tail (Real-time Streaming)

```
Topics → Select Topic → Live Mode (toggle)
```

See events as they arrive in real-time!

### 2. Message Filtering

```
Topics → Select Topic → Advanced Search
```

Filter by:
- Partition
- Offset range
- Timestamp range
- Key pattern
- Value content (JSON search)

### 3. Consumer Group Reset

If a consumer gets stuck:

```
Consumer Groups → Select Group → Reset Offsets
```

Options:
- **Earliest**: Replay all messages
- **Latest**: Skip to newest
- **Custom Offset**: Jump to specific point

### 4. Topic Configuration

```
Topics → Select Topic → Configuration
```

View/Edit:
- Retention period
- Partition count
- Replication factor
- Cleanup policy

## 📈 Monitoring Dashboard

### Key Metrics to Watch

| Metric | Where | Healthy | Issue |
|--------|-------|---------|-------|
| **Message Rate** | Topics → Messages count | Steady | Dropping to 0 |
| **Consumer Lag** | Consumer Groups → Lag | < 100 | > 1000 |
| **Partition Balance** | Topics → Partitions | Even distribution | All in one |
| **Error Topics** | Topics list | Low/zero | Growing |

### Health Check Endpoints

```bash
# Escrow Service Health
curl http://localhost:3004/v1/health

# Kafka Broker Health
curl http://localhost:9644/admin/brokers
```

## 🐛 Troubleshooting

### No Messages Showing

**Check**:
1. Is Kafka running? `docker ps | grep redpanda`
2. Is service configured? Check `.env` → `KAFKA_ENABLED=true`
3. Are events being produced? Check service logs

**Fix**:
```bash
# Restart Kafka
docker-compose restart redpanda kafka-ui

# Check logs
docker logs escrowly-redpanda
docker logs escrowly-kafka-ui
```

### Consumer Lag Increasing

**Possible Causes**:
- Consumer service down
- Processing too slow
- Database bottleneck

**Fix**:
```bash
# Check consumer service
docker logs escrow-ledger-service

# Scale consumers (if using Kubernetes)
kubectl scale deployment ledger-service --replicas=3
```

### Events Not Reaching Consumer

**Check**:
1. Is consumer subscribed? Check code: `kafka.subscribe(topic, handler)`
2. Is `startConsuming()` called? Check `onModuleInit`
3. Consumer group ID correct? Check `.env`

**Debug**:
```typescript
// Add logging in consumer
this.kafka.subscribe(EscrowTopics.CREATED, async (event) => {
  console.log('Received event:', event.metadata.eventId);
});
```

## 🎨 Kafka UI Screenshots Guide

### Main Dashboard
Shows overview of all topics and brokers

### Topics View
```
┌─────────────────────────────────────────┐
│ Topic Name            | Messages | Size  │
├─────────────────────────────────────────┤
│ escrow.created        |   1,234  | 2.3MB │
│ escrow.payment.comp.. |     567  | 1.1MB │
│ escrow.disputed       |      45  | 89KB  │
│ auth.user.created     |   2,890  | 4.5MB │
└─────────────────────────────────────────┘
```

### Message Details
```
┌─────────────────────────────────────────┐
│ Offset: 1234                            │
│ Partition: 0                            │
│ Timestamp: 2025-12-12 18:30:00         │
│ Key: esc-123                           │
├─────────────────────────────────────────┤
│ Headers:                               │
│   eventId: 550e8400...                 │
│   eventType: escrow.created            │
│   source: escrow-service               │
├─────────────────────────────────────────┤
│ Value (JSON):                          │
│ {                                      │
│   "metadata": { ... },                 │
│   "payload": { ... }                   │
│ }                                      │
└─────────────────────────────────────────┘
```

## 🔐 Security Notes

⚠️ **Kafka UI is for development only!**

For production:
- Add authentication (basic auth, OAuth)
- Restrict network access
- Enable HTTPS
- Set read-only mode
- Use separate monitoring tool (Prometheus + Grafana)

## 📚 Additional Resources

- [Kafka UI GitHub](https://github.com/provectus/kafka-ui)
- [Apache Kafka Docs](https://kafka.apache.org/documentation/)
- [@escrowly/kafka-core README](../packages/kafka-core/README.md)
- [Redpanda Docs](https://docs.redpanda.com/)

## 🚀 Next Steps

1. **Start Kafka UI**: `docker-compose --profile dev up -d`
2. **Open Browser**: http://localhost:8080
3. **Trigger an event**: Create an escrow via API
4. **Watch it flow**: See it in Kafka UI Topics
5. **Monitor consumer**: Check ledger-consumer-group lag

Happy monitoring! 🎉

