# BFF → Notification Service Integration Guide

## 📋 Overview

This document explains how the **Notification Service** is integrated into the **BFF (Backend-for-Frontend)** service, following the exact same pattern as the **Inquiry Service** integration.

**Integration Pattern:** BFF acts as a pure HTTP proxy, forwarding all requests to the Notification Service without any business logic or event production.

---

## 🏗️ Architecture

### Service Communication Flow

```
Frontend
  ↓ HTTP Request
BFF (Port 3001)
  ↓ Proxy Request
Notification Service (Port 3005)
  ↓ Process Request
  ↓ Return Response
BFF
  ↓ Forward Response
Frontend
```

### Key Principles

1. **Pure Proxy Pattern**: BFF forwards requests unchanged to Notification Service
2. **No Business Logic**: BFF contains no notification logic - all handled by Notification Service
3. **JWT Authentication**: All routes require JWT authentication (enforced by global guard)
4. **Role-Based Access**: Admin endpoints require admin role (enforced by Notification Service)

---

## 📁 File Structure

```
services/bff/src/notification/
├── notification.controller.ts      # User endpoints
├── admin-notification.controller.ts # Admin endpoints
├── template.controller.ts          # Template management endpoints
├── notification.module.ts          # NestJS module
└── index.ts                        # Exports
```

---

## 🔌 Integration Components

### 1. ProxyService Extension

**File:** `services/bff/src/proxy/proxy.service.ts`

Added `proxyToNotification()` method to forward requests to Notification Service:

```typescript
/**
 * Proxy request to Notification service
 */
async proxyToNotification<T>(
  method: string,
  path: string,
  data?: any,
  headers?: Record<string, string>
): Promise<T> {
  return this.proxyRequest<T>(
    this.notificationServiceUrl,
    method,
    path,
    data,
    headers
  );
}
```

**Configuration:**
- Environment variable: `NOTIFICATION_SERVICE_URL`
- Default: `http://localhost:3005`

---

### 2. NotificationController (User Endpoints)

**File:** `services/bff/src/notification/notification.controller.ts`

**Endpoints:**
- `GET /api/v1/notifications/settings` - Get current user's notification settings
- `PUT /api/v1/notifications/settings` - Update current user's notification settings
- `GET /api/v1/notifications/user/:userId` - Get notification history for user

**Example Request:**
```bash
curl -X GET http://localhost:3001/api/v1/notifications/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**
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

---

### 3. AdminNotificationController (Admin Endpoints)

**File:** `services/bff/src/notification/admin-notification.controller.ts`

**Endpoints:**
- `GET /api/v1/notifications/settings/:userId` - Get user settings (admin)
- `PUT /api/v1/notifications/settings/:userId` - Update user settings (admin)
- `GET /api/v1/notifications/admin/logs` - Query notification logs (admin)
- `POST /api/v1/notifications/test-send` - Send test email (admin)
- `POST /api/v1/notifications/retry/:notificationId` - Retry failed notification (admin)

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/v1/notifications/admin/logs?page=1&limit=20&status=failed" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "notif-123",
      "userId": "user-456",
      "eventType": "escrow.completed",
      "eventKey": "escrow-789",
      "templateId": "escrow_completed_v1",
      "recipientEmail": "user@example.com",
      "subject": "Escrow Completed",
      "status": "failed",
      "errorMessage": "Invalid email address",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### 4. TemplateController (Template Management)

**File:** `services/bff/src/notification/template.controller.ts`

**Endpoints:**
- `GET /api/v1/admin/templates` - List all templates
- `GET /api/v1/admin/templates/:templateId` - Get template by ID
- `POST /api/v1/admin/templates` - Register new template
- `PUT /api/v1/admin/templates/:templateId` - Update template
- `DELETE /api/v1/admin/templates/:templateId` - Delete template

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/v1/admin/templates \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "escrow_created_v1",
    "name": "Escrow Created",
    "description": "Email sent when a new escrow is created",
    "subject": "New escrow created: {{escrowId}}",
    "html": "<h1>New Escrow Created</h1><p>Your escrow <strong>{{escrowId}}</strong> has been created.</p>",
    "variables": "[\"escrowId\", \"amount\", \"asset\", \"escrowUrl\"]",
    "version": "v1",
    "isActive": true
  }'
```

**Example Response:**
```json
{
  "id": "template-uuid",
  "templateId": "escrow_created_v1",
  "name": "Escrow Created",
  "description": "Email sent when a new escrow is created",
  "subject": "New escrow created: {{escrowId}}",
  "html": "<h1>New Escrow Created</h1>...",
  "variables": "[\"escrowId\", \"amount\", \"asset\", \"escrowUrl\"]",
  "isActive": true,
  "version": "v1",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

### 5. NotificationModule

**File:** `services/bff/src/notification/notification.module.ts`

Groups all notification-related controllers:

```typescript
@Module({
  controllers: [
    NotificationController,
    AdminNotificationController,
    TemplateController,
  ],
})
export class NotificationModule {}
```

**Registered in:** `services/bff/src/app.module.ts`

---

## 🔄 Request/Response Flow

### Example: Get User Notification Settings

```
1. Frontend → BFF
   GET /api/v1/notifications/settings
   Headers: Authorization: Bearer JWT_TOKEN

2. BFF (NotificationController)
   - Receives request
   - Logs: [BFF → Notification] GET /api/v1/notifications/settings
   - Calls: proxyService.proxyToNotification('GET', '/api/v1/notifications/settings', null, { Authorization: ... })

3. BFF (ProxyService)
   - Builds URL: http://localhost:3005/api/v1/notifications/settings
   - Forwards request with headers
   - Waits for response

4. Notification Service
   - Validates JWT token
   - Extracts user ID from token
   - Queries database for user settings
   - Returns settings JSON

5. BFF (ProxyService)
   - Receives response
   - Forwards to controller

6. BFF (NotificationController)
   - Returns response to frontend

7. Frontend
   - Receives notification settings
```

---

## 🧪 Testing

### Prerequisites

1. **Notification Service Running:**
   ```bash
   cd services/notification
   npm run dev
   # Service runs on http://localhost:3005
   ```

2. **BFF Service Running:**
   ```bash
   cd services/bff
   npm run dev
   # Service runs on http://localhost:3001
   ```

3. **Environment Variables:**
   ```bash
   # services/bff/.env
   NOTIFICATION_SERVICE_URL=http://localhost:3005
   ```

### Test User Endpoints

```bash
# Get user settings
curl -X GET http://localhost:3001/api/v1/notifications/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update user settings
curl -X PUT http://localhost:3001/api/v1/notifications/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": {
      "transaction_events": true,
      "account_events": false,
      "milestone_events": true,
      "marketing_emails": false
    }
  }'

# Get notification history
curl -X GET http://localhost:3001/api/v1/notifications/user/user-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Admin Endpoints

```bash
# Query logs
curl -X GET "http://localhost:3001/api/v1/notifications/admin/logs?page=1&limit=10&status=failed" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Send test email
curl -X POST http://localhost:3001/api/v1/notifications/test-send \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Test</h1><p>This is a test email.</p>"
  }'

# Retry failed notification
curl -X POST http://localhost:3001/api/v1/notifications/retry/notif-123 \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

### Test Template Endpoints

```bash
# List templates
curl -X GET http://localhost:3001/api/v1/admin/templates \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Get template
curl -X GET http://localhost:3001/api/v1/admin/templates/escrow_created_v1 \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Create template
curl -X POST http://localhost:3001/api/v1/admin/templates \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "test_template_v1",
    "name": "Test Template",
    "description": "Test email template",
    "subject": "Test: {{name}}",
    "html": "<h1>Hello {{name}}</h1>",
    "variables": "[\"name\"]",
    "version": "v1",
    "isActive": true
  }'
```

---

## 🔍 Error Handling

### BFF Error Handling

BFF uses `ProxyService` which handles errors consistently:

1. **HTTP Errors (4xx, 5xx):**
   - Forwarded from Notification Service
   - Status code preserved
   - Error message preserved

2. **Network Errors:**
   - Connection refused → 500 Internal Server Error
   - Timeout → 500 Internal Server Error
   - Logged with full details

3. **Authentication Errors:**
   - 401 Unauthorized → Forwarded from Notification Service
   - 403 Forbidden → Forwarded from Notification Service

### Example Error Response

```json
{
  "message": "Template with templateId 'escrow_created_v1' already exists",
  "error": "Conflict",
  "statusCode": 409
}
```

---

## 📊 Logging

### BFF Logging Pattern

All requests are logged with the pattern:
```
[BFF → Notification] METHOD /api/v1/path
```

**Example Logs:**
```
[BFF → Notification] GET /api/v1/notifications/settings
[BFF → Notification] POST /api/v1/admin/templates
[BFF → Notification] PUT /api/v1/notifications/settings/user-123
```

### ProxyService Logging

ProxyService logs detailed request/response information:
- Request URL
- Request headers (Authorization header presence)
- Response status
- Response data

---

## 🔐 Security

### Authentication

- **Global Guard:** `JwtAuthGuard` validates JWT tokens on all routes
- **Token Forwarding:** Authorization header is forwarded to Notification Service
- **Token Validation:** Notification Service validates token and extracts user ID

### Authorization

- **User Endpoints:** Accessible to authenticated users
- **Admin Endpoints:** Require admin role (enforced by Notification Service)
- **Template Endpoints:** Require admin role (enforced by Notification Service)

---

## 🚀 Deployment

### Environment Variables

**BFF Service (.env):**
```bash
NOTIFICATION_SERVICE_URL=http://notification-service:3006
```

**Docker Compose:**
```yaml
services:
  bff-service:
    environment:
      - NOTIFICATION_SERVICE_URL=http://notification-service:3005
```

### Service Discovery

In production, use service names for internal communication:
- Development: `http://localhost:3006`
- Docker: `http://notification-service:3006`
- Kubernetes: `http://notification-service:3005` (via service name)

---

## 📈 Monitoring

### Health Checks

**BFF Health:**
```bash
curl http://localhost:3001/api/v1/health
```

**Notification Service Health:**
```bash
curl http://localhost:3005/api/v1/health
```

### Metrics to Monitor

1. **Request Count:** Number of requests proxied to Notification Service
2. **Error Rate:** Percentage of failed requests
3. **Response Time:** Average response time from Notification Service
4. **Authentication Failures:** 401/403 error count

---

## 🔧 Maintenance

### Adding New Endpoints

To add a new Notification Service endpoint to BFF:

1. **Identify Endpoint Type:**
   - User endpoint → Add to `NotificationController`
   - Admin endpoint → Add to `AdminNotificationController`
   - Template endpoint → Add to `TemplateController`

2. **Add Method:**
   ```typescript
   @Get('new-endpoint')
   @ApiBearerAuth('JWT-auth')
   @ApiOperation({ summary: 'New endpoint description' })
   async newEndpoint(
     @Headers('authorization') authHeader: string,
   ): Promise<any> {
     this.logger.log('[BFF → Notification] GET /api/v1/notifications/new-endpoint');
     return this.proxyService.proxyToNotification(
       'GET',
       '/api/v1/notifications/new-endpoint',
       null,
       { Authorization: authHeader },
     );
   }
   ```

3. **Test:**
   - Test endpoint via BFF
   - Verify response matches Notification Service response
   - Check logs for proper forwarding

### Updating Endpoints

1. **Update Controller:** Modify method signature/parameters
2. **Update Swagger:** Update `@ApiOperation` and `@ApiResponse` decorators
3. **Test:** Verify changes work correctly

---

## 🎯 Best Practices

### 1. Follow Inquiry Service Pattern

- Use same controller structure
- Use same logging pattern
- Use same error handling
- Use same Swagger documentation style

### 2. Keep BFF Thin

- **DO:** Forward requests unchanged
- **DON'T:** Add business logic
- **DON'T:** Transform request/response (unless necessary)
- **DON'T:** Cache responses (let Notification Service handle caching)

### 3. Error Handling

- **DO:** Forward errors from Notification Service
- **DON'T:** Swallow errors
- **DO:** Log all errors with context

### 4. Security

- **DO:** Forward Authorization header
- **DON'T:** Modify JWT token
- **DO:** Let Notification Service validate permissions

---

## 📚 Related Documentation

- **Notification Service:** `services/notification/README.md`
- **Inquiry Service Integration:** `services/bff/src/inquiry/` (reference implementation)
- **ProxyService:** `services/bff/src/proxy/proxy.service.ts`
- **BFF Architecture:** `services/bff/src/app.module.ts`

---

## ✅ Integration Checklist

- [x] ProxyService extended with `proxyToNotification()`
- [x] NotificationController created (user endpoints)
- [x] AdminNotificationController created (admin endpoints)
- [x] TemplateController created (template management)
- [x] NotificationModule created and registered
- [x] Module added to `app.module.ts`
- [x] Environment variable configured
- [x] Documentation created
- [x] All endpoints tested
- [x] Error handling verified
- [x] Logging verified

---

## 🎉 Summary

The Notification Service integration in BFF follows the **exact same pattern** as the Inquiry Service integration:

1. **Pure Proxy:** BFF forwards requests unchanged
2. **No Business Logic:** All logic handled by Notification Service
3. **Consistent Pattern:** Same structure as Inquiry Service
4. **Complete Coverage:** All Notification Service endpoints proxied
5. **Production Ready:** Error handling, logging, and security in place

The integration is **complete and production-ready**! 🚀

