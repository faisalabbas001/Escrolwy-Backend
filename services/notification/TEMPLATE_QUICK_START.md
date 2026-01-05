# Template Setup - Quick Start

## ✅ Kafka Integration Status

**Kafka event consumption and production are NOT affected by template changes.**

The flow remains:
```
Kafka Event → Consumer → NotificationsService → TemplateService → EmailService → Resend
```

Only change: TemplateService now fetches templates from **database** instead of Resend API.

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Run Migration & Generate Prisma Client

```bash
# From project root
npm run notification:prisma:migrate
npm run notification:prisma:generate
```

### Step 2: Create Template in Resend Dashboard

1. Go to https://resend.com/templates
2. Create template with ID: `escrow_created_v1` (or your template ID)
3. Add subject: `New escrow created: {{escrowId}}`
4. Add HTML with Handlebars variables
5. Save

### Step 3: Register Template via API

```bash
curl -X POST http://localhost:3003/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "templateId": "escrow_created_v1",
    "name": "Escrow Created",
    "subject": "New escrow created: {{escrowId}}",
    "html": "<h1>New Escrow</h1><p>{{escrowId}}</p>",
    "variables": "[\"escrowId\", \"amount\", \"asset\"]"
  }'
```

---

## 📋 API Validation

The API automatically validates:

✅ **Handlebars Syntax** - Checks if `subject` and `html` are valid Handlebars  
✅ **Variable Matching** - Ensures all used variables are declared  
✅ **Uniqueness** - Prevents duplicate `templateId`  

---

## 🔍 Verify It Works

### List Templates
```bash
GET /api/v1/admin/templates
```

### Check Kafka Flow
1. Send a Kafka event (e.g., `escrow.created`)
2. Check notification logs: `GET /api/v1/notifications/admin/logs`
3. Email should be sent ✅

---

## 📚 Full Documentation

See `TEMPLATE_SETUP_GUIDE.md` for complete details.

