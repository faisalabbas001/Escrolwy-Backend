# Resend Template Management Implementation

## ✅ Implementation Complete

All admin template management endpoints now use **Resend's built-in template API** instead of database storage.

### Why Resend Templates?

As recommended by [Resend's template documentation](https://resend.com/docs/dashboard/templates/introduction), using Resend's template management provides:

1. **Built-in CRUD API** - No need to maintain our own database schema
2. **Version Control** - Resend handles template versioning automatically
3. **Dashboard Interface** - Templates can be managed via Resend dashboard or API
4. **Collaboration** - Real-time collaboration features built-in
5. **Efficient Sending** - Can send emails directly using template IDs (no manual rendering needed)

---

## 📋 Implemented Endpoints

All endpoints use Resend's API:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/admin/templates` | List all templates from Resend |
| GET | `/api/v1/admin/templates/:templateId` | Get template by Resend ID |
| POST | `/api/v1/admin/templates` | Create template in Resend |
| PUT | `/api/v1/admin/templates/:templateId` | Update template in Resend |
| DELETE | `/api/v1/admin/templates/:templateId` | Delete template from Resend |

### Features

- ✅ **Admin-only access** - Protected with `@Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)`
- ✅ **Resend API integration** - Direct calls to Resend's template API
- ✅ **Error handling** - Proper error handling with NotFoundException and BadRequestException
- ✅ **Template fetching** - TemplateService fetches from Resend first, falls back to hardcoded
- ✅ **Direct template sending** - EmailService supports sending with Resend template IDs

---

## 🔧 Architecture Changes

### 1. ResendTemplateService

New service that wraps Resend's template API:

```typescript
class ResendTemplateService {
  async findAll(): Promise<TemplateResponseDto[]>
  async findOne(id: string): Promise<TemplateResponseDto>
  async create(dto: CreateTemplateDto): Promise<TemplateResponseDto>
  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto>
  async remove(id: string): Promise<void>
}
```

**Reference**: [Resend Template API](https://resend.com/docs/api-reference/templates)

### 2. TemplateService Updated

Now fetches templates from Resend first:

```typescript
// Priority order:
// 1. Fetch from Resend (by templateId or alias)
// 2. Fallback to hardcoded templates
```

### 3. EmailService Enhanced

Added support for sending emails directly with Resend template IDs:

```typescript
// New method - more efficient than manual rendering
async sendEmailWithTemplate(
  to: string,
  templateId: string,
  templateVariables: Record<string, any>
): Promise<string>
```

This allows Resend to handle template rendering server-side, which is more efficient.

---

## 📝 Example Usage

### Create Template in Resend

```bash
curl -X POST http://localhost:3005/api/v1/admin/templates \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "inquiry_message_sent_v1",
    "name": "Inquiry Message Sent",
    "description": "Email sent when a new message is added to an inquiry",
    "subject": "New message in inquiry {{inquiryId}}",
    "html": "<h1>New Message</h1><p>You have a new message in inquiry {{inquiryId}}.</p>",
    "version": "v1",
    "isActive": true
  }'
```

### List Templates from Resend

```bash
curl -X GET http://localhost:3005/api/v1/admin/templates \
  -H "Authorization: Bearer <admin-jwt-token>"
```

**Note**: Resend API doesn't support server-side pagination, so all templates are returned.

### Send Email Using Resend Template

```typescript
// Option 1: Use Resend template directly (recommended - more efficient)
await emailService.sendEmailWithTemplate(
  "user@example.com",
  "tmpl_abc123", // Resend template ID
  {
    inquiryId: "inq_123",
    senderName: "John Doe",
    message: "Hello!"
  }
);

// Option 2: Fetch and render manually (current approach)
const rendered = await templateService.render("inquiry_message_sent_v1", variables);
await emailService.sendEmail(to, rendered.subject, rendered.html);
```

---

## 🔄 Migration Notes

### Database Schema

The `EmailTemplate` model in Prisma schema is **no longer used** for template storage. However, we keep it in the schema for:
- Potential caching layer (future enhancement)
- Migration compatibility
- Reference purposes

**You can remove it** if you want to fully commit to Resend-only templates.

### Backward Compatibility

The `TemplateService` maintains backward compatibility:

1. **First**: Tries to fetch template from Resend
2. **Fallback**: Uses hardcoded templates if Resend template not found
3. **Error**: Throws error only if neither Resend nor hardcoded template exists

This allows:
- Gradual migration from hardcoded to Resend templates
- Service continues working even if Resend API is unavailable
- Templates can be created via Resend dashboard or API

---

## 🎯 Benefits of Using Resend Templates

1. **No Database Storage** - Templates stored in Resend, reducing database load
2. **Version Control** - Resend handles versioning automatically
3. **Dashboard Management** - Templates can be edited via Resend dashboard
4. **Efficient Sending** - Direct template ID sending (no rendering needed)
5. **Collaboration** - Multiple team members can edit templates
6. **Less Code** - No need to maintain template CRUD logic

---

## 📚 References

- [Resend Templates Documentation](https://resend.com/docs/dashboard/templates/introduction)
- [Resend Template API Reference](https://resend.com/docs/api-reference/templates)
- [Resend Node.js SDK](https://resend.com/docs/send-with-nodejs)

---

## ✅ Status

All template management endpoints are **fully implemented** using Resend's API. The service is ready to use with Resend's template management system.

