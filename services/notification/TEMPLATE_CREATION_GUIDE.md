# Template Creation Guide - Per Service Event

Complete guide for creating separate Resend templates for every service event in the Escrowly platform.

---

## 📋 Overview

**Yes, you create a separate Resend template for every service event.**

Each Kafka event from different services (Escrow, Wallet, Inquiry) requires its own template. This guide shows you how to:

1. **Create templates in Resend Dashboard** (one per event type)
2. **Register templates in Notification Service database** (via API)
3. **Map events to templates** (already done in code, but you need to understand it)

---

## 🔄 Template Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    TEMPLATE WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Service emits Kafka event                                │
│     └─> escrow.created, wallet.deposit.completed, etc.      │
│                                                              │
│  2. Notification Service consumes event                     │
│     └─> NotificationMapper maps event → templateId          │
│                                                              │
│  3. TemplateService fetches template from database           │
│     └─> Uses templateId (e.g., "escrow_created_v1")         │
│                                                              │
│  4. TemplateService renders with variables                   │
│     └─> Handlebars replaces {{variableName}}                │
│                                                              │
│  5. EmailService sends via Resend                            │
│     └─> Uses templateId to reference Resend template        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Important:** Templates must exist in **both**:
- ✅ **Resend Dashboard** (for actual email sending)
- ✅ **Notification Service Database** (for metadata, validation, rendering)

---

## 📝 Template Naming Convention

Templates follow this pattern:

```
{service}_{event}_{version}
```

Examples:
- `escrow_created_v1` - Escrow service, created event, version 1
- `wallet_deposit_completed_v1` - Wallet service, deposit completed event, version 1
- `inquiry_message_received_v1` - Inquiry service, message received event, version 1

---

## 🏗️ Step-by-Step: Creating Templates

### Step 1: Create Template in Resend Dashboard

1. Go to [Resend Dashboard → Templates](https://resend.com/templates)
2. Click **"Create Template"**
3. Fill in:
   - **Template ID**: `escrow_created_v1` (must match exactly)
   - **Name**: `Escrow Created Email`
   - **Subject**: `New Escrow Created: {{escrowId}}`
   - **HTML Body**: Your email HTML with Handlebars variables

4. **Save** the template

**Note:** The template ID in Resend Dashboard **must exactly match** the `templateId` you'll register in the Notification Service.

### Step 2: Register Template in Notification Service

After creating in Resend Dashboard, register it via API:

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "escrow_created_v1",
    "name": "Escrow Created",
    "description": "Email sent when a new escrow is created",
    "subject": "New Escrow Created: {{escrowId}}",
    "html": "<h1>New Escrow Created</h1><p>Escrow ID: {{escrowId}}</p><p>Amount: {{amount}} {{asset}}</p><p><a href=\"{{escrowUrl}}\">View Escrow</a></p>",
    "variables": "[\"escrowId\", \"amount\", \"asset\", \"escrowUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Why register in database?**
- Validates Handlebars syntax
- Validates variable usage
- Stores metadata for rendering
- Allows template updates without Resend Dashboard changes

---

## 📧 Escrow Service Templates

### Template 1: `escrow_created_v1`

**Event:** `escrow.created`  
**Recipients:** Buyer + Seller  
**Mapped in:** `NotificationMapper.mapEscrowCreated()`

#### Resend Dashboard Setup

1. **Template ID:** `escrow_created_v1`
2. **Subject:** `New Escrow Created: {{escrowId}}`
3. **HTML Body:**
```html
<h1>New Escrow Created</h1>
<p>Hello,</p>
<p>A new escrow has been created:</p>
<ul>
  <li><strong>Escrow ID:</strong> {{escrowId}}</li>
  <li><strong>Amount:</strong> {{amount}} {{asset}}</li>
</ul>
<p><a href="{{escrowUrl}}">View Escrow</a></p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "escrow_created_v1",
    "name": "Escrow Created",
    "description": "Email sent when a new escrow is created",
    "subject": "New Escrow Created: {{escrowId}}",
    "html": "<h1>New Escrow Created</h1><p>Escrow ID: {{escrowId}}</p><p>Amount: {{amount}} {{asset}}</p><p><a href=\"{{escrowUrl}}\">View Escrow</a></p>",
    "variables": "[\"escrowId\", \"amount\", \"asset\", \"escrowUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `escrowId` - Escrow ID
- `amount` - Escrow amount
- `asset` - Asset type (USDT, BTC, etc.)
- `escrowUrl` - Link to view escrow

---

### Template 2: `escrow_completed_v1`

**Event:** `escrow.completed`  
**Recipients:** Seller  
**Mapped in:** `NotificationMapper.mapEscrowCompleted()`

#### Resend Dashboard Setup

1. **Template ID:** `escrow_completed_v1`
2. **Subject:** `Escrow Completed: {{escrowId}}`
3. **HTML Body:**
```html
<h1>Escrow Completed</h1>
<p>Hello,</p>
<p>Your escrow has been completed successfully:</p>
<ul>
  <li><strong>Escrow ID:</strong> {{escrowId}}</li>
  <li><strong>Amount:</strong> {{amount}} {{asset}}</li>
  <li><strong>Completed At:</strong> {{completedAt}}</li>
</ul>
<p><a href="{{escrowUrl}}">View Details</a></p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "escrow_completed_v1",
    "name": "Escrow Completed",
    "description": "Email sent to seller when escrow is completed",
    "subject": "Escrow Completed: {{escrowId}}",
    "html": "<h1>Escrow Completed</h1><p>Escrow ID: {{escrowId}}</p><p>Amount: {{amount}} {{asset}}</p><p>Completed: {{completedAt}}</p><p><a href=\"{{escrowUrl}}\">View Details</a></p>",
    "variables": "[\"escrowId\", \"amount\", \"asset\", \"completedAt\", \"escrowUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `escrowId` - Escrow ID
- `amount` - Escrow amount
- `asset` - Asset type
- `completedAt` - Completion timestamp
- `escrowUrl` - Link to view escrow

---

### Template 3: `escrow_disputed_v1`

**Event:** `escrow.disputed`  
**Recipients:** Buyer + Seller  
**Mapped in:** `NotificationMapper.mapEscrowDisputed()`

#### Resend Dashboard Setup

1. **Template ID:** `escrow_disputed_v1`
2. **Subject:** `Escrow Dispute Opened: {{escrowId}}`
3. **HTML Body:**
```html
<h1>Escrow Dispute Opened</h1>
<p>Hello,</p>
<p>A dispute has been opened for escrow {{escrowId}}:</p>
<ul>
  <li><strong>Escrow ID:</strong> {{escrowId}}</li>
  <li><strong>Reason:</strong> {{reason}}</li>
</ul>
<p><a href="{{escrowUrl}}">View Dispute</a></p>
<p>Our team will review the dispute and contact you shortly.</p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "escrow_disputed_v1",
    "name": "Escrow Disputed",
    "description": "Email sent when a dispute is opened for an escrow",
    "subject": "Escrow Dispute Opened: {{escrowId}}",
    "html": "<h1>Escrow Dispute Opened</h1><p>Escrow ID: {{escrowId}}</p><p>Reason: {{reason}}</p><p><a href=\"{{escrowUrl}}\">View Dispute</a></p>",
    "variables": "[\"escrowId\", \"reason\", \"escrowUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `escrowId` - Escrow ID
- `reason` - Dispute reason
- `escrowUrl` - Link to view escrow/dispute

---

## 💰 Wallet Service Templates

### Template 4: `wallet_deposit_completed_v1`

**Event:** `wallet.deposit.completed`  
**Recipients:** Wallet owner  
**Mapped in:** `NotificationMapper` (TODO - needs implementation)

#### Resend Dashboard Setup

1. **Template ID:** `wallet_deposit_completed_v1`
2. **Subject:** `Deposit Completed: {{amount}} {{asset}}`
3. **HTML Body:**
```html

<h1>Deposit Completed</h1>
<p>Hello,</p>
<p>Your deposit has been completed:</p>
<ul>
  <li><strong>Amount:</strong> {{amount}} {{asset}}</li>
  <li><strong>Transaction Hash:</strong> {{transactionHash}}</li>
  <li><strong>Completed At:</strong> {{completedAt}}</li>
</ul>
<p><a href="{{walletUrl}}">View Wallet</a></p>
<p>Best regards,<br>Escrowly Team</p>
```
```
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "wallet_deposit_completed_v1",
    "name": "Wallet Deposit Completed",
    "description": "Email sent when a wallet deposit is completed",
    "subject": "Deposit Completed: {{amount}} {{asset}}",
    "html": "<h1>Deposit Completed</h1><p>Amount: {{amount}} {{asset}}</p><p>Transaction: {{transactionHash}}</p><p>Completed: {{completedAt}}</p><p><a href=\"{{walletUrl}}\">View Wallet</a></p>",
    "variables": "[\"amount\", \"asset\", \"transactionHash\", \"completedAt\", \"walletUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `amount` - Deposit amount
- `asset` - Asset type
- `transactionHash` - Blockchain transaction hash
- `completedAt` - Completion timestamp
- `walletUrl` - Link to view wallet

**Note:** You'll need to add the mapping in `NotificationMapper.mapEventToIntents()`:

```typescript
case "wallet.deposit.completed":
  return this.mapWalletDepositCompleted(payload as WalletDepositCompletedPayload);
```

---

### Template 5: `wallet_withdrawal_failed_v1`

**Event:** `wallet.withdrawal.failed`  
**Recipients:** Wallet owner  
**Mapped in:** `NotificationMapper` (TODO - needs implementation)

#### Resend Dashboard Setup

1. **Template ID:** `wallet_withdrawal_failed_v1`
2. **Subject:** `Withdrawal Failed: {{amount}} {{asset}}`
3. **HTML Body:**
```html
<h1>Withdrawal Failed</h1>
<p>Hello,</p>
<p>Your withdrawal request has failed:</p>
<ul>
  <li><strong>Amount:</strong> {{amount}} {{asset}}</li>
  <li><strong>Reason:</strong> {{errorMessage}}</li>
  <li><strong>Failed At:</strong> {{failedAt}}</li>
</ul>
<p>Your funds remain in your wallet. Please try again or contact support.</p>
<p><a href="{{walletUrl}}">View Wallet</a></p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "wallet_withdrawal_failed_v1",
    "name": "Wallet Withdrawal Failed",
    "description": "Email sent when a wallet withdrawal fails",
    "subject": "Withdrawal Failed: {{amount}} {{asset}}",
    "html": "<h1>Withdrawal Failed</h1><p>Amount: {{amount}} {{asset}}</p><p>Reason: {{errorMessage}}</p><p>Failed: {{failedAt}}</p><p><a href=\"{{walletUrl}}\">View Wallet</a></p>",
    "variables": "[\"amount\", \"asset\", \"errorMessage\", \"failedAt\", \"walletUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `amount` - Withdrawal amount
- `asset` - Asset type
- `errorMessage` - Failure reason
- `failedAt` - Failure timestamp
- `walletUrl` - Link to view wallet

---

### Template 6: `wallet_balance_low_v1`

**Event:** `wallet.balance.low`  
**Recipients:** Wallet owner  
**Mapped in:** `NotificationMapper` (TODO - needs implementation)

#### Resend Dashboard Setup

1. **Template ID:** `wallet_balance_low_v1`
2. **Subject:** `Low Balance Alert: {{currentBalance}} {{asset}}`
3. **HTML Body:**
```html
<h1>Low Balance Alert</h1>
<p>Hello,</p>
<p>Your wallet balance is running low:</p>
<ul>
  <li><strong>Current Balance:</strong> {{currentBalance}} {{asset}}</li>
  <li><strong>Minimum Recommended:</strong> {{minimumBalance}} {{asset}}</li>
</ul>
<p>Consider adding funds to avoid service interruptions.</p>
<p><a href="{{walletUrl}}">Add Funds</a></p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "wallet_balance_low_v1",
    "name": "Wallet Balance Low",
    "description": "Email sent when wallet balance falls below threshold",
    "subject": "Low Balance Alert: {{currentBalance}} {{asset}}",
    "html": "<h1>Low Balance Alert</h1><p>Current: {{currentBalance}} {{asset}}</p><p>Minimum: {{minimumBalance}} {{asset}}</p><p><a href=\"{{walletUrl}}\">Add Funds</a></p>",
    "variables": "[\"currentBalance\", \"asset\", \"minimumBalance\", \"walletUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `currentBalance` - Current wallet balance
- `asset` - Asset type
- `minimumBalance` - Minimum recommended balance
- `walletUrl` - Link to view/add funds

---

## 💬 Inquiry Service Templates

### Template 7: `inquiry_message_received_v1`

**Event:** `inquiry.message.added`  
**Recipients:** Opposite party (buyer or seller)  
**Mapped in:** `NotificationMapper.mapInquiryMessageAdded()`

#### Resend Dashboard Setup

1. **Template ID:** `inquiry_message_received_v1`
2. **Subject:** `New Message in Inquiry {{inquiryId}}`
3. **HTML Body:**
```html
<h1>New Message Received</h1>
<p>Hello,</p>
<p>You have received a new message in inquiry {{inquiryId}}:</p>
<ul>
  <li><strong>Inquiry ID:</strong> {{inquiryId}}</li>
  <li><strong>Escrow ID:</strong> {{escrowId}}</li>
  <li><strong>From:</strong> {{senderName}}</li>
  <li><strong>Message:</strong> {{message}}</li>
</ul>
<p><a href="{{inquiryUrl}}">Reply to Message</a></p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "inquiry_message_received_v1",
    "name": "Inquiry Message Received",
    "description": "Email sent when a new message is added to an inquiry",
    "subject": "New Message in Inquiry {{inquiryId}}",
    "html": "<h1>New Message Received</h1><p>Inquiry: {{inquiryId}}</p><p>Escrow: {{escrowId}}</p><p>From: {{senderName}}</p><p>Message: {{message}}</p><p><a href=\"{{inquiryUrl}}\">Reply</a></p>",
    "variables": "[\"inquiryId\", \"escrowId\", \"senderName\", \"message\", \"inquiryUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `inquiryId` - Inquiry ID
- `escrowId` - Related escrow ID
- `senderName` - Name of message sender
- `message` - Message content
- `inquiryUrl` - Link to view inquiry

**Note:** Current mapper uses `inquiry_message_sent_v1` - you may want to rename or add this as an alias.

---

### Template 8: `inquiry_resolved_v1`

**Event:** `inquiry.resolved`  
**Recipients:** Buyer + Seller  
**Mapped in:** `NotificationMapper.mapInquiryResolved()`

#### Resend Dashboard Setup

1. **Template ID:** `inquiry_resolved_v1`
2. **Subject:** `Inquiry Resolved: {{inquiryId}}`
3. **HTML Body:**
```html
<h1>Inquiry Resolved</h1>
<p>Hello,</p>
<p>Inquiry {{inquiryId}} has been resolved:</p>
<ul>
  <li><strong>Inquiry ID:</strong> {{inquiryId}}</li>
  <li><strong>Escrow ID:</strong> {{escrowId}}</li>
  <li><strong>Resolution:</strong> {{resolutionType}}</li>
  <li><strong>Notes:</strong> {{resolutionNote}}</li>
</ul>
<p><a href="{{inquiryUrl}}">View Resolution</a></p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "inquiry_resolved_v1",
    "name": "Inquiry Resolved",
    "description": "Email sent when an inquiry is resolved",
    "subject": "Inquiry Resolved: {{inquiryId}}",
    "html": "<h1>Inquiry Resolved</h1><p>Inquiry: {{inquiryId}}</p><p>Escrow: {{escrowId}}</p><p>Resolution: {{resolutionType}}</p><p>Notes: {{resolutionNote}}</p><p><a href=\"{{inquiryUrl}}\">View Resolution</a></p>",
    "variables": "[\"inquiryId\", \"escrowId\", \"resolutionType\", \"resolutionNote\", \"inquiryUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `inquiryId` - Inquiry ID
- `escrowId` - Related escrow ID
- `resolutionType` - Type of resolution
- `resolutionNote` - Resolution notes
- `inquiryUrl` - Link to view inquiry

---

### Template 9: `inquiry_closed_v1`

**Event:** `inquiry.closed`  
**Recipients:** Buyer + Seller  
**Mapped in:** `NotificationMapper` (TODO - needs implementation)

#### Resend Dashboard Setup

1. **Template ID:** `inquiry_closed_v1`
2. **Subject:** `Inquiry Closed: {{inquiryId}}`
3. **HTML Body:**
```html
<h1>Inquiry Closed</h1>
<p>Hello,</p>
<p>Inquiry {{inquiryId}} has been closed:</p>
<ul>
  <li><strong>Inquiry ID:</strong> {{inquiryId}}</li>
  <li><strong>Escrow ID:</strong> {{escrowId}}</li>
  <li><strong>Closed By:</strong> {{closedBy}}</li>
  <li><strong>Note:</strong> {{note}}</li>
</ul>
<p><a href="{{inquiryUrl}}">View Inquiry</a></p>
<p>Best regards,<br>Escrowly Team</p>
```

#### Register in Notification Service

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "inquiry_closed_v1",
    "name": "Inquiry Closed",
    "description": "Email sent when an inquiry is closed",
    "subject": "Inquiry Closed: {{inquiryId}}",
    "html": "<h1>Inquiry Closed</h1><p>Inquiry: {{inquiryId}}</p><p>Escrow: {{escrowId}}</p><p>Closed By: {{closedBy}}</p><p>Note: {{note}}</p><p><a href=\"{{inquiryUrl}}\">View Inquiry</a></p>",
    "variables": "[\"inquiryId\", \"escrowId\", \"closedBy\", \"note\", \"inquiryUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Available Variables:**
- `inquiryId` - Inquiry ID
- `escrowId` - Related escrow ID
- `closedBy` - User/admin who closed it
- `note` - Closing note
- `inquiryUrl` - Link to view inquiry

---

## 🔧 Adding New Event Mappings

When you create a new template, you need to:

### 1. Add Event Mapping in `NotificationMapper`

Edit `services/notification/src/mapper/notification.mapper.ts`:

```typescript
static mapEventToIntents(event: BaseEvent<any>): EmailIntent[] {
  const { payload, metadata } = event;
  const eventType = metadata.eventType;

  switch (eventType) {
    // ... existing cases ...
    
    case "wallet.deposit.completed":
      return this.mapWalletDepositCompleted(
        payload as WalletDepositCompletedPayload
      );
    
    default:
      return [];
  }
}

// Add mapping method
private static mapWalletDepositCompleted(
  payload: WalletDepositCompletedPayload
): EmailIntent[] {
  return [
    {
      userId: payload.userId,
      templateId: "wallet_deposit_completed_v1",
      variables: {
        amount: payload.amount,
        asset: payload.asset,
        transactionHash: payload.transactionHash,
        completedAt: payload.completedAt,
        walletUrl: `https://escrowly.com/wallet`,
      },
    },
  ];
}
```

### 2. Import Payload Type

Add to imports in `notification.mapper.ts`:

```typescript
import {
  // ... existing imports ...
  WalletDepositCompletedPayload,
} from "@escrowly/kafka-core";
```

**Note:** If the payload type doesn't exist in `kafka-core`, you'll need to add it to the schema first.

---

## ✅ Verification Checklist

After creating each template:

- [ ] Template created in Resend Dashboard with correct `templateId`
- [ ] Template registered in Notification Service database
- [ ] Handlebars syntax validated (API checks this)
- [ ] Variables match between template and mapper
- [ ] Event mapping added to `NotificationMapper` (if new event)
- [ ] Test event sent and email received
- [ ] Check notification logs: `GET /api/v1/notifications/admin/logs`

---

## 🧪 Testing a Template

### Step 1: Register Template

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Step 2: Verify Template

```bash
curl -X GET http://localhost:3005/api/v1/admin/templates/escrow_created_v1
```

### Step 3: Send Test Event

Publish a Kafka event (e.g., `escrow.created`) or use test scripts:

```bash
node test-escrow-completed-event.js
```

### Step 4: Check Results

```bash
# Check notification logs
curl "http://localhost:3005/api/v1/notifications/admin/logs?eventType=escrow.created"

# Check database
SELECT * FROM notification_db.notification_logs 
WHERE template_id = 'escrow_created_v1' 
ORDER BY created_at DESC LIMIT 1;
```

---

## 📊 Template Status Summary

| Template ID | Service | Event | Status | Mapper |
|------------|---------|-------|--------|--------|
| `escrow_created_v1` | Escrow | `escrow.created` | ✅ Implemented | `mapEscrowCreated()` |
| `escrow_completed_v1` | Escrow | `escrow.completed` | ✅ Implemented | `mapEscrowCompleted()` |
| `escrow_disputed_v1` | Escrow | `escrow.disputed` | ✅ Implemented | `mapEscrowDisputed()` |
| `wallet_deposit_completed_v1` | Wallet | `wallet.deposit.completed` | ⚠️ Needs mapper | TODO |
| `wallet_withdrawal_failed_v1` | Wallet | `wallet.withdrawal.failed` | ⚠️ Needs mapper | TODO |
| `wallet_balance_low_v1` | Wallet | `wallet.balance.low` | ⚠️ Needs mapper | TODO |
| `inquiry_message_received_v1` | Inquiry | `inquiry.message.added` | ⚠️ Uses different ID | `mapInquiryMessageAdded()` |
| `inquiry_resolved_v1` | Inquiry | `inquiry.resolved` | ✅ Implemented | `mapInquiryResolved()` |
| `inquiry_closed_v1` | Inquiry | `inquiry.closed` | ⚠️ Needs mapper | TODO |

---

## 🎯 Quick Reference

### All Templates at Once

Create all templates in Resend Dashboard, then register all via API:

```bash
# Escrow templates
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...escrow_created_v1...}'
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...escrow_completed_v1...}'
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...escrow_disputed_v1...}'

# Wallet templates
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...wallet_deposit_completed_v1...}'
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...wallet_withdrawal_failed_v1...}'
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...wallet_balance_low_v1...}'

# Inquiry templates
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...inquiry_message_received_v1...}'
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...inquiry_resolved_v1...}'
curl -X POST http://localhost:3005/api/v1/admin/templates -d '{...inquiry_closed_v1...}'
```

### List All Registered Templates

```bash
curl -X GET http://localhost:3005/api/v1/admin/templates
```

---

## 📚 Related Documentation

- **Template Quick Start:** `TEMPLATE_QUICK_START.md`
- **Testing Guide:** `TESTING_FLOW_GUIDE.md`
- **API Documentation:** http://localhost:3005/api/docs

---

## 🎉 Summary

**Yes, you create a separate Resend template for every service event.**

**Workflow:**
1. Create template in Resend Dashboard (with exact `templateId`)
2. Register template in Notification Service database (via API)
3. Add event mapping in `NotificationMapper` (if new event type)
4. Test by sending Kafka event

**Each template:**
- Has unique `templateId` matching event type
- Uses Handlebars variables for dynamic content
- Must exist in both Resend Dashboard and Notification Service database
- Is mapped from Kafka events via `NotificationMapper`

This ensures each service event has its own dedicated email template with proper branding, content, and variables.

