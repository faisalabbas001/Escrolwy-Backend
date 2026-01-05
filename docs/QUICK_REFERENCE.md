# Quick Reference Card

## 🚀 Start Services

```bash
# All services + dev tools
docker-compose --profile dev up -d

# Just infrastructure
docker-compose up -d postgres redis redpanda

# Just Kafka UI
docker-compose up -d redpanda kafka-ui
```

## 🌐 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Kafka UI** | http://localhost:8080 | - |
| **PgAdmin** | http://localhost:5050 | admin@escrowly.local / admin |
| **Mailhog** | http://localhost:8025 | - |
| **Auth API** | http://localhost:3000/docs | - |
| **Escrow API** | http://localhost:3004/docs | - |
| **BFF API** | http://localhost:3001/docs | - |

## 📋 Kafka Topics

### Escrow Events
- `escrow.created`
- `escrow.accepted`
- `escrow.payment.completed` → **Ledger: reserve_funds**
- `escrow.delivery.started`
- `escrow.inspection.completed`
- `escrow.completed` → **Ledger: release_to_seller**
- `escrow.cancelled`
- `escrow.disputed` → **Ledger: freeze_funds**
- `escrow.resolved` → **Ledger: varies**
- `escrow.force.closed`

### Auth Events
- `auth.user.created` → **Ledger: create_wallet**
- `auth.session.created`
- `auth.kyc.approved`

### Ledger Events
- `ledger.balance.reserved`
- `ledger.balance.released`
- `ledger.transaction.confirmed`

## 🔍 Common Commands

### View Kafka Events
```bash
# In Kafka UI: Topics → Select Topic → Messages
```

### Check Consumer Lag
```bash
# In Kafka UI: Consumer Groups → Select Group
```

### Test Event Production
```bash
# Create an escrow
curl -X POST http://localhost:3004/v1/escrows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"buyerId":"...", "sellerId":"...", "amount": 1000}'

# Check in Kafka UI
# Topics → escrow.created → Messages (should see new event)
```

### Service Health
```bash
curl http://localhost:3004/v1/health  # Escrow
curl http://localhost:3000/v1/health  # Auth
curl http://localhost:3001/health     # BFF
```

## 🐛 Troubleshooting

### Kafka UI Not Loading
```bash
docker logs escrowly-kafka-ui
docker-compose restart kafka-ui
```

### No Events Showing
1. Check `KAFKA_ENABLED=true` in `.env`
2. Restart service: `npm run escrow:dev`
3. Check logs for errors

### Consumer Lag Growing
```bash
# Check consumer service logs
docker logs escrow-ledger-service

# Reset consumer offset (in Kafka UI)
Consumer Groups → ledger-consumer-group → Reset Offsets
```

## 📊 Monitoring Checklist

- [ ] Kafka UI accessible (http://localhost:8080)
- [ ] Topics created (escrow.*, auth.*, ledger.*)
- [ ] Messages flowing (check message count)
- [ ] Consumer lag < 100 (Consumer Groups tab)
- [ ] No errors in service logs

## 🔗 Documentation

- **Kafka Monitoring**: [docs/KAFKA_MONITORING.md](./KAFKA_MONITORING.md)
- **kafka-core Package**: [packages/kafka-core/README.md](../packages/kafka-core/README.md)
- **Escrow Kafka**: [services/escrow/src/kafka/README.md](../services/escrow/src/kafka/README.md)

## 📞 Quick Help

**Event not showing in Kafka UI?**
→ Check service logs, verify KAFKA_ENABLED=true

**Consumer not processing?**
→ Check Consumer Groups tab for lag, restart consumer service

**Need to replay events?**
→ Consumer Groups → Reset Offsets → Choose earliest/latest

**Want to test manually?**
→ Topics → Select Topic → Produce Message → Paste JSON

