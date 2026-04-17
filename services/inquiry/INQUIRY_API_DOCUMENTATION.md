# Inquiry Service - API Documentation & Database Structure

## 📋 Overview

The Inquiry Service is a customer support system that allows users (buyers and sellers) to create inquiries related to their escrow transactions. Admins can manage, assign, and resolve these inquiries. The service supports messages, attachments, and integrates with Kafka for event-driven communication.

---

## 🗄️ Database Structure (Prisma Schema)

### Database Schema: `inquiry_db`

The service uses PostgreSQL with a dedicated schema. Here's how data is organized:

### 1. **inquiries** Table
This is the main table that stores inquiry records.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (Primary Key) | Unique identifier for each inquiry |
| `escrow_id` | String (Unique) | Links inquiry to an escrow transaction - **One inquiry per escrow** |
| `created_by` | String | User ID who created the inquiry |
| `assigned_admin_id` | String (Nullable) | Admin user ID assigned to handle this inquiry (null if unassigned) |
| `status` | Enum: `open` or `closed` | Current status of the inquiry (default: `open`) |
| `created_at` | DateTime | When the inquiry was created |
| `updated_at` | DateTime | Last update timestamp (auto-updated) |

**Key Points:**
- Each escrow can have **only one inquiry** (unique constraint on `escrow_id`)
- Status can be `open` or `closed`
- Indexed on `escrow_id` for fast lookups

---

### 2. **inquiry_messages** Table
Stores all messages/communications within an inquiry.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (Primary Key) | Unique message identifier |
| `inquiry_id` | String (Foreign Key) | Links to the parent inquiry |
| `sender_id` | String | User ID who sent the message |
| `sender_role` | Enum: `buyer`, `seller`, or `admin` | Role of the person sending the message |
| `message` | String (Nullable) | The actual message content |
| `created_at` | DateTime | When the message was sent |

**Key Points:**
- Multiple messages can belong to one inquiry (one-to-many relationship)
- Messages are automatically deleted if the inquiry is deleted (CASCADE)
- Indexed on `inquiry_id` and `created_at` for efficient querying
- Messages can be from buyers, sellers, or admins

---

### 3. **inquiry_attachments** Table
Stores file attachments linked to messages.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (Primary Key) | Unique attachment identifier |
| `inquiry_id` | String (Foreign Key) | Links to the parent inquiry |
| `message_id` | String (Foreign Key) | Links to the specific message this attachment belongs to |
| `file_url` | String | S3 URL where the file is stored |
| `file_type` | String | Type of file: `pdf`, `image`, `document`, `spreadsheet`, or `other` |
| `created_at` | DateTime | When the attachment was uploaded |

**Key Points:**
- Attachments must belong to both an inquiry AND a specific message
- Automatically deleted if inquiry or message is deleted (CASCADE)
- File URL points to S3 storage location

---

### 4. **OutboxEvent** Table (Internal)
Used for reliable Kafka event publishing (Transactional Outbox Pattern).

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (Primary Key) | Unique event identifier |
| `topic` | String | Kafka topic name |
| `partitionKey` | String | Partition key (usually inquiryId) |
| `payload` | Text (JSON) | Serialized event data |
| `status` | String | `pending`, `published`, or `failed` |
| `retryCount` | Integer | Number of publish attempts |
| `lastError` | Text (Nullable) | Last error message if failed |
| `createdAt` | DateTime | When event was created |
| `publishedAt` | DateTime (Nullable) | When successfully published |
| `nextRetryAt` | DateTime (Nullable) | Next retry time for failed events |

**Key Points:**
- Ensures events are never lost - written in same transaction as data changes
- Events are processed asynchronously by an outbox processor
- Supports retry logic for failed publishes

---

## 🔗 Database Relationships

```
inquiries (1) ──< (many) inquiry_messages
   │                      │
   │                      │
   └──< (many) inquiry_attachments <──┘
```

- **One Inquiry** can have **Many Messages**
- **One Inquiry** can have **Many Attachments**
- **One Message** can have **Many Attachments**
- All relationships use CASCADE delete (deleting inquiry deletes all related data)

---

## 🚀 API Endpoints

### **User/Buyer/Seller Endpoints**

These endpoints are used by regular users (buyers and sellers) to manage their inquiries.

---

#### 1. **Create Inquiry**
**POST** `/api/v1/inquiries`

**What it does:** Creates a new inquiry for an escrow transaction.

**Request Body:**
```json
{
  "escrow_id": "escrow-123",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "initial_message": "I have a question about this transaction" // Optional
}
```

**What happens in the database:**
1. Checks if an inquiry already exists for this escrow (prevents duplicates)
2. Creates a new record in `inquiries` table with:
   - Auto-generated UUID for `id`
   - Status set to `open`
   - Timestamps auto-set
3. If `initial_message` is provided, also creates a message in `inquiry_messages` table
4. Publishes `inquiry.created` event to Kafka (via outbox)

**Response:** Returns the created inquiry object

**Error Cases:**
- 409 Conflict: Inquiry already exists for this escrow
- 400 Bad Request: Validation errors

---

#### 2. **Get Inquiry by ID**
**GET** `/api/v1/inquiries/:inquiryId`

**What it does:** Retrieves a specific inquiry with its latest messages and attachments.

**What happens in the database:**
- Queries `inquiries` table by `id`
- Includes last 5 messages (ordered by newest first)
- Includes last 10 attachments (ordered by newest first)

**Response:** Inquiry object with related messages and attachments

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist

---

#### 3. **Get Inquiry by Escrow ID**
**GET** `/api/v1/inquiries/escrow/:escrowId`

**What it does:** Finds an inquiry using the escrow ID instead of inquiry ID.

**What happens in the database:**
- Queries `inquiries` table by `escrow_id` (unique field)
- Includes all messages and attachments (ordered by newest first)

**Response:** Inquiry object with all related messages and attachments

**Error Cases:**
- 404 Not Found: No inquiry found for this escrow

---

#### 4. **Close Inquiry**
**POST** `/api/v1/inquiries/:inquiryId/close`

**What it does:** Allows users to close their own inquiry.

**Request Body:**
```json
{
  "status": "closed", // or "resolved"
  "note": "Issue resolved, thank you" // Optional
}
```

**What happens in the database:**
1. Checks if inquiry exists and is not already closed
2. Updates `inquiries` table: sets `status` to `closed` or `resolved`
3. Updates `updated_at` timestamp automatically
4. Publishes `inquiry.closed` event to Kafka

**Response:** Updated inquiry object

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist
- 400 Bad Request: Inquiry already closed

---

### **Message Endpoints**

These endpoints handle communication within inquiries.

---

#### 5. **Add Message**
**POST** `/api/v1/inquiries/:inquiryId/messages`

**What it does:** Adds a new message to an inquiry conversation.

**Request Body:**
```json
{
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_role": "buyer", // or "seller" or "admin"
  "message": "I would like to clarify the payment terms"
}
```

**What happens in the database:**
1. Verifies inquiry exists and is not closed
2. Creates new record in `inquiry_messages` table with:
   - Auto-generated UUID for `id`
   - Links to inquiry via `inquiry_id`
   - Stores sender information and message content
   - Auto-sets `created_at` timestamp
3. Publishes `inquiry.message.added` event to Kafka

**Response:** Created message object

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist
- 400 Bad Request: Inquiry is closed (can't add messages)

---

#### 6. **Get Messages (Paginated)**
**GET** `/api/v1/inquiries/:inquiryId/messages?page=1&limit=20`

**What it does:** Retrieves all messages for an inquiry with pagination.

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**What happens in the database:**
- Queries `inquiry_messages` table filtered by `inquiry_id`
- Orders messages by `created_at` ascending (oldest first)
- Applies pagination (skip/take)
- Counts total messages for pagination metadata

**Response:**
```json
{
  "data": [...messages...],
  "total": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist

---

### **Attachment Endpoints**

These endpoints handle file uploads and retrieval.

---

#### 7. **Add Attachment**
**POST** `/api/v1/inquiries/:inquiryId/attachments`

**What it does:** Links a file attachment to a specific message in an inquiry.

**Request Body:**
```json
{
  "message_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_url": "https://s3.amazonaws.com/escrowly-files/invoice.pdf",
  "file_type": "pdf" // or "image", "document", "spreadsheet", "other"
}
```

**What happens in the database:**
1. Verifies inquiry exists
2. Verifies message exists and belongs to this inquiry
3. Creates new record in `inquiry_attachments` table with:
   - Auto-generated UUID for `id`
   - Links to both inquiry (`inquiry_id`) and message (`message_id`)
   - Stores S3 file URL and file type
   - Auto-sets `created_at` timestamp
4. Publishes `inquiry.attachment.uploaded` event to Kafka

**Response:** Created attachment object

**Error Cases:**
- 404 Not Found: Inquiry or message doesn't exist
- 400 Bad Request: Message doesn't belong to this inquiry

---

#### 8. **Get Attachments (Paginated)**
**GET** `/api/v1/inquiries/:inquiryId/attachments?page=1&limit=20`

**What it does:** Retrieves all attachments for an inquiry with pagination.

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**What happens in the database:**
- Queries `inquiry_attachments` table filtered by `inquiry_id`
- Orders attachments by `created_at` descending (newest first)
- Applies pagination
- Counts total attachments

**Response:**
```json
{
  "data": [...attachments...],
  "total": 12,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist

---

### **Admin Endpoints**

These endpoints are for administrators to manage inquiries.

---

#### 9. **List Inquiries (Admin)**
**GET** `/api/v1/admin/inquiries?page=1&limit=20&status=open&assignedAdminId=admin-123`

**What it does:** Retrieves a paginated list of all inquiries with filtering options.

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page
- `status` (optional): Filter by `open`, `resolved`, or `closed`
- `assignedAdminId` (optional): Filter by assigned admin

**What happens in the database:**
- Queries `inquiries` table with optional filters
- Includes last 3 messages and last 5 attachments for each inquiry
- Orders by `created_at` descending (newest first)
- Applies pagination
- Counts total matching inquiries

**Response:**
```json
{
  "data": [
    {
      ...inquiry...,
      "message_count": 5,
      "attachment_count": 2,
      "latest_messages": [...]
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

---

#### 10. **Get Inquiry Detail (Admin)**
**GET** `/api/v1/admin/inquiries/:id`

**What it does:** Retrieves full details of an inquiry including all messages and attachments.

**What happens in the database:**
- Queries `inquiries` table by `id`
- Includes ALL messages (ordered by newest first)
- Includes ALL attachments (ordered by newest first)
- Adds message and attachment counts

**Response:** Complete inquiry object with all related data

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist

---

#### 11. **Assign Inquiry to Admin**
**POST** `/api/v1/admin/inquiries/:id/assign`

**What it does:** Assigns an inquiry to a specific admin for handling.

**Request Body:**
```json
{
  "admin_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**What happens in the database:**
1. Verifies inquiry exists
2. Updates `inquiries` table: sets `assigned_admin_id` field
3. Updates `updated_at` timestamp automatically
4. Publishes `inquiry.assigned` event to Kafka

**Response:** Updated inquiry object

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist

---

#### 12. **Resolve Inquiry (Admin)**
**POST** `/api/v1/admin/inquiries/:id/resolve`

**What it does:** Allows admins to resolve an inquiry with a resolution note.

**Request Body:**
```json
{
  "status": "resolved", // or "closed"
  "resolution_note": "Issue resolved by providing refund to buyer"
}
```

**What happens in the database:**
1. Verifies inquiry exists
2. Updates `inquiries` table: sets `status` to `resolved` or `closed`
3. Creates a new message in `inquiry_messages` table with:
   - `sender_role`: `admin`
   - `message`: `[RESOLUTION] {resolution_note}`
   - This serves as the official resolution record
4. Updates `updated_at` timestamp
5. Publishes `inquiry.resolved` event to Kafka

**Response:** Updated inquiry object

**Error Cases:**
- 404 Not Found: Inquiry doesn't exist

---

## 🔄 Event-Driven Features

The service integrates with Kafka for event-driven communication:

### Events Published (via Outbox Pattern):
1. **inquiry.created** - When a new inquiry is created
2. **inquiry.closed** - When an inquiry is closed by user
3. **inquiry.assigned** - When an admin is assigned
4. **inquiry.resolved** - When an admin resolves an inquiry
5. **inquiry.message.added** - When a new message is added
6. **inquiry.attachment.uploaded** - When a file is attached

### Events Consumed:
The service listens to escrow dispute events:
- **dispute.opened** → Auto-creates an inquiry for the disputed escrow
- **dispute.resolved** → Auto-closes the related inquiry with resolution message

---

## 📊 Data Flow Summary

### Creating an Inquiry:
```
User Request → Create Inquiry → DB Transaction:
  ├─ Insert into inquiries table
  ├─ (Optional) Insert into inquiry_messages table
  └─ Insert into OutboxEvent table (for Kafka)
     → Outbox Processor → Kafka Topic
```

### Adding a Message:
```
User Request → Add Message → DB Transaction:
  ├─ Insert into inquiry_messages table
  └─ Insert into OutboxEvent table
     → Outbox Processor → Kafka Topic
```

### Admin Resolving:
```
Admin Request → Resolve Inquiry → DB Transaction:
  ├─ Update inquiries.status
  ├─ Insert into inquiry_messages (resolution note)
  └─ Insert into OutboxEvent table
     → Outbox Processor → Kafka Topic
```

---

## 🔐 Key Business Rules

1. **One Inquiry Per Escrow**: Each escrow transaction can have only one inquiry (enforced by unique constraint)

2. **No Messages on Closed Inquiries**: Once an inquiry is closed, no new messages can be added

3. **Attachments Must Belong to Messages**: Every attachment must be linked to a specific message

4. **Cascade Deletes**: Deleting an inquiry automatically deletes all related messages and attachments

5. **Status Values**: 
   - `open`: Inquiry is active and can receive messages
   - `closed`: Inquiry is closed, no new messages allowed

6. **Sender Roles**: Messages can be from `buyer`, `seller`, or `admin`

---

## 💡 Use Cases

1. **Buyer has a question** → Creates inquiry with initial message → Admin responds → Issue resolved
2. **Dispute occurs** → System auto-creates inquiry → Admin assigned → Admin resolves with notes
3. **Seller needs clarification** → Adds message to existing inquiry → Buyer responds with attachment → Admin reviews and resolves
4. **Admin monitoring** → Views all open inquiries → Filters by assigned admin → Resolves with resolution note

---

## 📝 Notes

- All timestamps are automatically managed by Prisma
- UUIDs are auto-generated for all primary keys
- The service uses the Transactional Outbox Pattern to ensure reliable Kafka event publishing
- File uploads are handled externally (S3), the service only stores the URL
- Pagination is used for list endpoints to handle large datasets efficiently
