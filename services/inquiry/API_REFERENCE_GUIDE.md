# Inquiry Service - Complete API Reference Guide

## Table of Contents
1. [HTTP REST APIs](#http-rest-apis)
2. [WebSocket Events](#websocket-events)
3. [Testing Instructions](#testing-instructions)
4. [Complete Conversation Flow](#complete-conversation-flow)

---

## HTTP REST APIs

### Base URL
```
http://localhost:3003/api/v1
```

### Authentication
All endpoints require JWT Bearer token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 1. Inquiry Management Endpoints

### 1.1 Create Inquiry
**POST** `/inquiries`

**Purpose:** Create a new support inquiry/ticket for an escrow transaction.

**Request Body:**
```json
{
  "escrow_id": "escrow-123",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "initial_message": "I have a question about this transaction" // Optional
}
```

**Response (201 Created):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "escrow_id": "escrow-123",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "assigned_admin_id": null,
  "status": "open",
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

**Note:** `assigned_admin_id` is `null` by default when an inquiry is created. Admins can still access and view unassigned inquiries using the admin endpoints:
- **List all inquiries:** `GET /admin/inquiries` (includes unassigned inquiries)
- **View inquiry details:** `GET /admin/inquiries/:id` (works for any inquiry, even unassigned)
- **Join WebSocket room:** Admins can join any inquiry conversation via WebSocket with `user_role: "admin"` to see real-time messages and attachments
- **Assign later:** Use `POST /admin/inquiries/:id/assign` to assign an admin to the inquiry

**cURL Example:**
```bash
curl -X POST http://localhost:3003/api/v1/inquiries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "escrow_id": "escrow-123",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "initial_message": "I need help with this transaction"
  }'
```

---

### 1.2 Get Inquiry by ID
**GET** `/inquiries/:inquiryId`

**Purpose:** Retrieve inquiry details including recent messages and attachments.

**Path Parameters:**
- `inquiryId` (UUID) - Inquiry ID

**Response (200 OK):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "escrow_id": "escrow-123",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "assigned_admin_id": "880e8400-e29b-41d4-a716-446655440002",
  "status": "open",
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z",
  "messages": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440003",
      "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
      "sender_id": "550e8400-e29b-41d4-a716-446655440000",
      "sender_role": "buyer",
      "message": "I need help with this transaction",
      "created_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "attachments": []
}
`
{
    "id": "ad21c452-fe80-418d-8c0e-05cdbc52a028",
    "escrow_id": "escrow-1",
    "created_by": "550e8400-e29b-41d4-a716-446655440997",
    "assigned_admin_id": null,
    "status": "open",
    "created_at": "2025-12-22T12:02:26.208Z",
    "updated_at": "2025-12-22T12:02:26.208Z",
    "messages": [
        {
            "id": "9738999d-c833-4bb3-b7b8-fba6656bbc4b",
            "inquiry_id": "ad21c452-fe80-418d-8c0e-05cdbc52a028",
            "sender_id": "550e8400-e29b-41d4-a716-446655448888",
            "sender_role": "admin",
            "message": "provide any proof",
            "created_at": "2025-12-22T12:06:45.610Z"
        },
        {
            "id": "3429c393-a0c5-45cd-8f5c-3d1dcaf45f5d",
            "inquiry_id": "ad21c452-fe80-418d-8c0e-05cdbc52a028",
            "sender_id": "550e8400-e29b-41d4-a716-446655440997",
            "sender_role": "buyer",
            "message": "I have a question about this transaction by sradr",
            "created_at": "2025-12-22T12:02:26.214Z"
        }
    ],
    "attachments": [
        {
            "id": "9aefe4b1-d321-417d-8a1d-c3ba5f008441",
            "inquiry_id": "ad21c452-fe80-418d-8c0e-05cdbc52a028",
            "message_id": "9738999d-c833-4bb3-b7b8-fba6656bbc4b",
            "file_url": "https://dev-escrowly-stack-devescrowlyfilesd7d0fc74-nlzj6dxdllaf.s3.us-east-1.amazonaws.com/escrowly-inquiries/ad21c452-fe80-418d-8c0e-05cdbc52a028/e4904441-1d5d-43cb-a4c0-e6b24060d8ad.png",
            "file_type": "image",
            "created_at": "2025-12-22T12:37:42.632Z"
        }
    ]
}




``

**cURL Example:**
```bash
curl -X GET http://localhost:3003/api/v1/inquiries/770e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 1.3 Get Inquiry by Escrow ID
**GET** `/inquiries/escrow/:escrowId`

**Purpose:** Find inquiry associated with a specific escrow transaction.

**Path Parameters:**
- `escrowId` (string) - Escrow ID

**Response:** Same as Get Inquiry by ID

**cURL Example:**
```bash
curl -X GET http://localhost:3003/api/v1/inquiries/escrow/escrow-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Note:** Users (buyers/sellers) cannot close inquiries themselves. Only admins can resolve inquiries using the admin endpoint `POST /admin/inquiries/:id/resolve`.

---

## 2. Message Endpoints

### 2.1 Add Message
**POST** `/inquiries/:inquiryId/messages`

**Purpose:** Send a message in the inquiry conversation. Message is persisted and broadcast via WebSocket.

**Path Parameters:**
- `inquiryId` (UUID) - Inquiry ID

**Request Body:**
```json
{
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_role": "buyer", // Options: "buyer", "seller", "admin"
  "message": "I would like to clarify the payment terms"
}
```

**Response (201 Created):**
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440004",
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_role": "buyer",
  "message": "I would like to clarify the payment terms",
  "created_at": "2024-01-15T10:05:00.000Z"
}
```

**WebSocket Event Triggered:** `message_received` (broadcast to all room participants)

**cURL Example:**
```bash
curl -X POST http://localhost:3003/api/v1/inquiries/770e8400-e29b-41d4-a716-446655440001/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sender_id": "550e8400-e29b-41d4-a716-446655440000",
    "sender_role": "buyer",
    "message": "I would like to clarify the payment terms"
  }'
```

---

### 2.2 Get Messages (Paginated)
**GET** `/inquiries/:inquiryId/messages`

**Purpose:** Retrieve paginated list of messages for an inquiry.

**Path Parameters:**
- `inquiryId` (UUID) - Inquiry ID

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440004",
      "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
      "sender_id": "550e8400-e29b-41d4-a716-446655440000",
      "sender_role": "buyer",
      "message": "I would like to clarify the payment terms",
      "created_at": "2024-01-15T10:05:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:3003/api/v1/inquiries/770e8400-e29b-41d4-a716-446655440001/messages?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 3. Attachment Endpoints

### 3.1 Add Attachment (Manual)
**POST** `/inquiries/:inquiryId/attachments`

**Purpose:** Add an attachment record when you already have an S3 URL.

**Path Parameters:**
- `inquiryId` (UUID) - Inquiry ID

**Request Body:**
```json
{
  "message_id": "aa0e8400-e29b-41d4-a716-446655440004",
  "file_url": "https://bucket.s3.amazonaws.com/escrowly-inquiries/file.pdf",
  "file_type": "pdf" // Options: "pdf", "image", "document", "spreadsheet", "other"
}
```

**Response (201 Created):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440005",
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "message_id": "aa0e8400-e29b-41d4-a716-446655440004",
  "file_url": "https://bucket.s3.amazonaws.com/escrowly-inquiries/file.pdf",
  "file_type": "pdf",
  "created_at": "2024-01-15T10:10:00.000Z"
}
```

**WebSocket Event Triggered:** `attachment_uploaded` (broadcast to all room participants)

**cURL Example:**
```bash
curl -X POST http://localhost:3003/api/v1/inquiries/770e8400-e29b-41d4-a716-446655440001/attachments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message_id": "aa0e8400-e29b-41d4-a716-446655440004",
    "file_url": "https://bucket.s3.amazonaws.com/escrowly-inquiries/file.pdf",
    "file_type": "pdf"
  }'
```

---

### 3.2 Upload File and Create Attachment
**POST** `/inquiries/:inquiryId/attachments/upload`

**Purpose:** Upload a file to S3 and create attachment record in one call. This is the recommended method.

**Path Parameters:**
- `inquiryId` (UUID) - Inquiry ID

**Request Body (multipart/form-data):**
- `file` (binary) - File to upload (max 10MB)
- `message_id` (string) - Message UUID this attachment belongs to

**Supported File Types:**
- Images: JPEG, PNG, WebP, GIF
- Documents: PDF, DOC, DOCX
- Spreadsheets: XLS, XLSX
- Text: TXT

**Response (201 Created):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440005",
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "message_id": "aa0e8400-e29b-41d4-a716-446655440004",
  "file_url": "https://bucket.s3.us-east-1.amazonaws.com/escrowly-inquiries/770e8400-e29b-41d4-a716-446655440001/uuid.pdf",
  "file_type": "pdf",
  "created_at": "2024-01-15T10:10:00.000Z"
}
```

**WebSocket Event Triggered:** `attachment_uploaded` (broadcast to all room participants)

**cURL Example:**
```bash
curl -X POST http://localhost:3003/api/v1/inquiries/770e8400-e29b-41d4-a716-446655440001/attachments/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F "message_id=aa0e8400-e29b-41d4-a716-446655440004"
```

---

### 3.3 Get Attachments (Paginated)
**GET** `/inquiries/:inquiryId/attachments`

**Purpose:** Retrieve paginated list of attachments for an inquiry.

**Path Parameters:**
- `inquiryId` (UUID) - Inquiry ID

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440005",
      "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
      "message_id": "aa0e8400-e29b-41d4-a716-446655440004",
      "file_url": "https://bucket.s3.amazonaws.com/escrowly-inquiries/file.pdf",
      "file_type": "pdf",
      "created_at": "2024-01-15T10:10:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:3003/api/v1/inquiries/770e8400-e29b-41d4-a716-446655440001/attachments?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 4. Admin Endpoints

### 4.1 List Inquiries (Admin)
**GET** `/admin/inquiries`

**Purpose:** Get paginated list of all inquiries with filtering options (admin only).

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20)
- `status` (string, optional) - Filter by status: "open", "resolved", "closed"
- `assignedAdminId` (string, optional) - Filter by assigned admin ID

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440001",
      "escrow_id": "escrow-123",
      "created_by": "550e8400-e29b-41d4-a716-446655440000",
      "assigned_admin_id": "880e8400-e29b-41d4-a716-446655440002",
      "status": "open",
      "message_count": 5,
      "attachment_count": 2,
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z",
      "latest_messages": [...]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:3003/api/v1/admin/inquiries?page=1&limit=20&status=open" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4.2 Get Inquiry Detail (Admin)
**GET** `/admin/inquiries/:id`

**Purpose:** Get full inquiry details including all messages and attachments (admin only).

**Path Parameters:**
- `id` (UUID) - Inquiry ID

**Response:** Same structure as Get Inquiry by ID, but includes all messages and attachments (not limited)

**Important:** Admins can access **ANY** inquiry using this endpoint, even if `assigned_admin_id` is `null`. This allows admins to:
- View all messages from buyers and sellers
- See all attachments
- Join the WebSocket conversation room
- Send messages and respond
- Then assign themselves using the assign endpoint

**cURL Example:**
```bash
curl -X GET http://localhost:3003/api/v1/admin/inquiries/770e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4.3 Assign Inquiry to Admin
**POST** `/admin/inquiries/:id/assign`

**Purpose:** Assign an inquiry to a specific admin user.

**Path Parameters:**
- `id` (UUID) - Inquiry ID

**Request Body:**
```json
{
  "admin_id": "880e8400-e29b-41d4-a716-446655440002"
}
```

**Response (200 OK):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "assigned_admin_id": "880e8400-e29b-41d4-a716-446655440002",
  "updated_at": "2024-01-15T10:15:00.000Z"
}
```

**WebSocket Event Triggered:** `inquiry_updated` with `update_type: "admin_assigned"`

**cURL Example:**
```bash
curl -X POST http://localhost:3003/api/v1/admin/inquiries/770e8400-e29b-41d4-a716-446655440001/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "admin_id": "880e8400-e29b-41d4-a716-446655440002"
  }'
```

---

### 4.4 Resolve Inquiry (Admin)
**POST** `/admin/inquiries/:id/resolve`

**Purpose:** Admin provides official resolution and closes the inquiry. Creates a resolution message in the conversation.

**Path Parameters:**
- `id` (UUID) - Inquiry ID

**Request Body:**
```json
{
  "status": "Refund to Buyer", // Options: "Refund to Buyer", "Release to Seller", "Split Funds"
  "resolution_note": "After reviewing the case, we will refund the buyer due to non-delivery."
}
```

**Response (200 OK):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "status": "closed",
  "updated_at": "2024-01-15T11:00:00.000Z"
}
```

**What Happens:**
1. Inquiry status updated to "closed"
2. Resolution message created in conversation (if `resolution_note` provided)
3. WebSocket event `inquiry_updated` broadcast with `update_type: "resolved"`

**cURL Example:**
```bash
curl -X POST http://localhost:3003/api/v1/admin/inquiries/770e8400-e29b-41d4-a716-446655440001/resolve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "Refund to Buyer",
    "resolution_note": "After reviewing the case, we will refund the buyer due to non-delivery."
  }'
```

---

## WebSocket Events

### Connection

**WebSocket URL:**
```
ws://localhost:3003/inquiry
```

**Namespace:** `/inquiry`

**Connection Example (JavaScript):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3003/inquiry', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected to Inquiry WebSocket');
});
```

---

## Client → Server Events (Send to Server)

### 1. Join Inquiry Room
**Event:** `join_inquiry`

**Purpose:** Join a conversation room to receive real-time updates for a specific inquiry.

**Payload:**
```json
{
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_role": "buyer" // Options: "buyer", "seller", "admin"
}
```

**Response:**
```json
{
  "success": true,
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "message": "Joined inquiry conversation",
  "participants": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_role": "buyer"
    }
  ]
}
```

**Server Events Triggered:**
- `user_joined` (broadcast to other participants)

**JavaScript Example:**
```javascript
socket.emit('join_inquiry', {
  inquiry_id: '770e8400-e29b-41d4-a716-446655440001',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  user_role: 'buyer'
});
```

---

### 2. Leave Inquiry Room
**Event:** `leave_inquiry`

**Purpose:** Leave a conversation room.

**Payload:**
```json
{
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Left inquiry conversation"
}
```

**Server Events Triggered:**
- `user_left` (broadcast to other participants)

**JavaScript Example:**
```javascript
socket.emit('leave_inquiry', {
  inquiry_id: '770e8400-e29b-41d4-a716-446655440001',
  user_id: '550e8400-e29b-41d4-a716-446655440000'
});
```

---

### 3. Send Message via WebSocket
**Event:** `send_message`

**Purpose:** Send a message through WebSocket. Message is persisted to database and broadcast to all room participants.

**Payload:**
```json
{
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_role": "buyer",
  "message": "Hello, I need help with this transaction"
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "aa0e8400-e29b-41d4-a716-446655440004",
    "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
    "sender_id": "550e8400-e29b-41d4-a716-446655440000",
    "sender_role": "buyer",
    "message": "Hello, I need help with this transaction",
    "created_at": "2024-01-15T10:05:00.000Z"
  }
}
```

**Server Events Triggered:**
- `message_received` (broadcast to all room participants including sender)

**JavaScript Example:**
```javascript
socket.emit('send_message', {
  inquiry_id: '770e8400-e29b-41d4-a716-446655440001',
  sender_id: '550e8400-e29b-41d4-a716-446655440000',
  sender_role: 'buyer',
  message: 'Hello, I need help with this transaction'
});
```

---

### 4. Typing Start
**Event:** `typing_start`

**Purpose:** Indicate that user has started typing.

**Payload:**
```json
{
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_role": "buyer",
  "display_name": "John Doe" // Optional
}
```

**Server Events Triggered:**
- `user_typing` with `is_typing: true` (broadcast to other participants, not sender)

**JavaScript Example:**
```javascript
socket.emit('typing_start', {
  inquiry_id: '770e8400-e29b-41d4-a716-446655440001',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  user_role: 'buyer'
});
```

---

### 5. Typing Stop
**Event:** `typing_stop`

**Purpose:** Indicate that user has stopped typing.

**Payload:** Same as `typing_start`

**Server Events Triggered:**
- `user_typing` with `is_typing: false` (broadcast to other participants)

**JavaScript Example:**
```javascript
socket.emit('typing_stop', {
  inquiry_id: '770e8400-e29b-41d4-a716-446655440001',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  user_role: 'buyer'
});
```

---

## Server → Client Events (Receive from Server)

### 1. Message Received
**Event:** `message_received`

**Purpose:** Broadcast when a new message is added to the conversation (via HTTP or WebSocket).

**Payload:**
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440004",
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_role": "buyer",
  "message": "Hello, I need help with this transaction",
  "created_at": "2024-01-15T10:05:00.000Z"
}
```

**Triggered By:**
- HTTP POST `/inquiries/:id/messages`
- WebSocket `send_message` event

**JavaScript Example:**
```javascript
socket.on('message_received', (message) => {
  console.log('New message:', message);
  // Update UI with new message
});
```

---

### 2. Attachment Uploaded
**Event:** `attachment_uploaded`

**Purpose:** Broadcast when a new attachment is uploaded.

**Payload:**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440005",
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "message_id": "aa0e8400-e29b-41d4-a716-446655440004",
  "file_url": "https://bucket.s3.amazonaws.com/escrowly-inquiries/file.pdf",
  "file_type": "pdf",
  "uploaded_by": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-15T10:10:00.000Z"
}
```

**Triggered By:**
- HTTP POST `/inquiries/:id/attachments`
- HTTP POST `/inquiries/:id/attachments/upload`

**JavaScript Example:**
```javascript
socket.on('attachment_uploaded', (attachment) => {
  console.log('New attachment:', attachment);
  // Update UI with new attachment
});
```

---

### 3. User Joined
**Event:** `user_joined`

**Purpose:** Notify when a user joins the conversation room.

**Payload:**
```json
{
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "user_id": "880e8400-e29b-41d4-a716-446655440002",
  "user_role": "admin",
  "timestamp": "2024-01-15T10:15:00.000Z"
}
```

**Triggered By:**
- WebSocket `join_inquiry` event

**JavaScript Example:**
```javascript
socket.on('user_joined', (data) => {
  console.log(`${data.user_role} joined the conversation`);
  // Update UI to show user is online
});
```

---

### 4. User Left
**Event:** `user_left`

**Purpose:** Notify when a user leaves the conversation room.

**Payload:** Same structure as `user_joined`

**Triggered By:**
- WebSocket `leave_inquiry` event
- WebSocket disconnect

**JavaScript Example:**
```javascript
socket.on('user_left', (data) => {
  console.log(`${data.user_role} left the conversation`);
  // Update UI to show user is offline
});
```

---

### 5. User Typing
**Event:** `user_typing`

**Purpose:** Show typing indicator for other users.

**Payload:**
```json
{
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_role": "buyer",
  "is_typing": true
}
```

**Triggered By:**
- WebSocket `typing_start` event
- WebSocket `typing_stop` event

**JavaScript Example:**
```javascript
socket.on('user_typing', (data) => {
  if (data.is_typing) {
    console.log(`${data.user_role} is typing...`);
    // Show typing indicator in UI
  } else {
    // Hide typing indicator
  }
});
```

---

### 6. Inquiry Updated
**Event:** `inquiry_updated`

**Purpose:** Notify when inquiry status or assignment changes.

**Payload:**
```json
{
  "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
  "status": "closed",
  "assigned_admin_id": "880e8400-e29b-41d4-a716-446655440002", // Optional
  "updated_at": "2024-01-15T11:00:00.000Z",
  "update_type": "resolved" // Options: "status_change", "admin_assigned", "resolved", "closed"
}
```

**Triggered By:**
- HTTP POST `/admin/inquiries/:id/assign` (update_type: "admin_assigned")
- HTTP POST `/admin/inquiries/:id/resolve` (update_type: "resolved")

**JavaScript Example:**
```javascript
socket.on('inquiry_updated', (update) => {
  console.log(`Inquiry ${update.update_type}:`, update);
  // Update UI with new inquiry status
});
```

---

### 7. Error
**Event:** `error`

**Purpose:** Notify client of errors (validation, not found, etc.).

**Payload:**
```json
{
  "code": "INQUIRY_NOT_FOUND",
  "message": "Inquiry not found",
  "details": {} // Optional
}
```

**JavaScript Example:**
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
  // Show error message to user
});
```

---

## Testing Instructions

### Testing HTTP APIs with Postman

1. **Setup:**
   - Create a new Postman collection: "Inquiry Service APIs"
   - Set base URL variable: `{{baseUrl}} = http://localhost:3003/api/v1`
   - Set auth token variable: `{{token}} = YOUR_JWT_TOKEN`

2. **Create Inquiry:**
   - Method: POST
   - URL: `{{baseUrl}}/inquiries`
   - Headers: `Authorization: Bearer {{token}}`
   - Body (JSON):
     ```json
     {
       "escrow_id": "escrow-123",
       "created_by": "550e8400-e29b-41d4-a716-446655440000",
       "initial_message": "I need help"
     }
     ```

3. **Add Message:**
   - Method: POST
   - URL: `{{baseUrl}}/inquiries/{{inquiryId}}/messages`
   - Headers: `Authorization: Bearer {{token}}`
   - Body (JSON):
     ```json
     {
       "sender_id": "550e8400-e29b-41d4-a716-446655440000",
       "sender_role": "buyer",
       "message": "Hello, I need assistance"
     }
     ```

4. **Upload File:**
   - Method: POST
   - URL: `{{baseUrl}}/inquiries/{{inquiryId}}/attachments/upload`
   - Headers: `Authorization: Bearer {{token}}`
   - Body (form-data):
     - `file`: [Select File]
     - `message_id`: `{{messageId}}`

---

### Testing WebSocket with Postman

1. **Create WebSocket Request:**
   - URL: `ws://localhost:3003/inquiry`
   - Click "Connect"

2. **Join Room:**
   - Send message:
     ```json
     {
       "event": "join_inquiry",
       "data": {
         "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
         "user_id": "550e8400-e29b-41d4-a716-446655440000",
         "user_role": "buyer"
       }
     }
     ```

3. **Send Message:**
   - Send message:
     ```json
     {
       "event": "send_message",
       "data": {
         "inquiry_id": "770e8400-e29b-41d4-a716-446655440001",
         "sender_id": "550e8400-e29b-41d4-a716-446655440000",
         "sender_role": "buyer",
         "message": "Hello via WebSocket"
       }
     }
     ```

4. **Listen for Events:**
   - Watch the messages tab for incoming events like `message_received`, `user_joined`, etc.

---

### Testing WebSocket with JavaScript/Node.js

**Complete Example:**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3003/inquiry', {
  transports: ['websocket', 'polling'],
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected');
  
  // Join inquiry room
  socket.emit('join_inquiry', {
    inquiry_id: '770e8400-e29b-41d4-a716-446655440001',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    user_role: 'buyer'
  });
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

// Listen for messages
socket.on('message_received', (message) => {
  console.log('📨 New message:', message);
});

socket.on('attachment_uploaded', (attachment) => {
  console.log('📎 New attachment:', attachment);
});

socket.on('user_joined', (data) => {
  console.log('👤 User joined:', data);
});

socket.on('user_typing', (data) => {
  console.log('⌨️ User typing:', data);
});

socket.on('inquiry_updated', (update) => {
  console.log('🔄 Inquiry updated:', update);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Send a message
socket.emit('send_message', {
  inquiry_id: '770e8400-e29b-41d4-a716-446655440001',
  sender_id: '550e8400-e29b-41d4-a716-446655440000',
  sender_role: 'buyer',
  message: 'Hello from WebSocket!'
});
```

---

## Complete Conversation Flow

### Scenario: Buyer creates inquiry, Admin responds, Seller uploads document

**Step-by-Step Sequence:**

#### Step 1: Buyer Creates Inquiry
**HTTP Request:**
```bash
POST /api/v1/inquiries
{
  "escrow_id": "escrow-123",
  "created_by": "buyer-user-id",
  "initial_message": "I have a question about the delivery"
}
```

**Response:**
```json
{
  "id": "inquiry-001",
  "escrow_id": "escrow-123",
  "status": "open",
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

**Result:** Inquiry created in database with initial message.

---

#### Step 2: Buyer Joins WebSocket Room
**WebSocket Event:**
```javascript
socket.emit('join_inquiry', {
  inquiry_id: 'inquiry-001',
  user_id: 'buyer-user-id',
  user_role: 'buyer'
});
```

**Server Response:**
```json
{
  "success": true,
  "message": "Joined inquiry conversation",
  "participants": [{"user_id": "buyer-user-id", "user_role": "buyer"}]
}
```

**Result:** Buyer is now in the room, ready to receive real-time updates.

---

#### Step 3: Admin Joins WebSocket Room
**WebSocket Event:**
```javascript
socket.emit('join_inquiry', {
  inquiry_id: 'inquiry-001',
  user_id: 'admin-user-id',
  user_role: 'admin'
});
```

**Server Events:**
- Admin receives: `{success: true, ...}`
- Buyer receives: `user_joined` event with admin info

**Result:** Both users are in the room.

---

#### Step 4: Admin Assigns Inquiry to Himself
**HTTP Request:**
```bash
POST /api/v1/admin/inquiries/inquiry-001/assign
{
  "admin_id": "admin-user-id"
}
```

**Response:**
```json
{
  "id": "inquiry-001",
  "assigned_admin_id": "admin-user-id",
  "updated_at": "2024-01-15T10:05:00.000Z"
}
```

**WebSocket Event (Both receive):**
```json
{
  "event": "inquiry_updated",
  "data": {
    "inquiry_id": "inquiry-001",
    "assigned_admin_id": "admin-user-id",
    "update_type": "admin_assigned",
    "updated_at": "2024-01-15T10:05:00.000Z"
  }
}
```

**Result:** Inquiry assigned, both users notified in real-time.

---

#### Step 5: Admin Sends Message via HTTP
**HTTP Request:**
```bash
POST /api/v1/inquiries/inquiry-001/messages
{
  "sender_id": "admin-user-id",
  "sender_role": "admin",
  "message": "Hello, I'm here to help. Can you provide more details?"
}
```

**Response:**
```json
{
  "id": "message-001",
  "inquiry_id": "inquiry-001",
  "sender_id": "admin-user-id",
  "sender_role": "admin",
  "message": "Hello, I'm here to help. Can you provide more details?",
  "created_at": "2024-01-15T10:06:00.000Z"
}
```

**WebSocket Event (Both receive):**
```json
{
  "event": "message_received",
  "data": {
    "id": "message-001",
    "inquiry_id": "inquiry-001",
    "sender_id": "admin-user-id",
    "sender_role": "admin",
    "message": "Hello, I'm here to help. Can you provide more details?",
    "created_at": "2024-01-15T10:06:00.000Z"
  }
}
```

**Result:** Message saved to database, both users see it instantly.

---

#### Step 6: Buyer Responds via WebSocket
**WebSocket Event:**
```javascript
socket.emit('send_message', {
  inquiry_id: 'inquiry-001',
  sender_id: 'buyer-user-id',
  sender_role: 'buyer',
  message: 'The package was supposed to arrive yesterday but I haven\'t received it.'
});
```

**Server Response:**
```json
{
  "success": true,
  "message": {
    "id": "message-002",
    "inquiry_id": "inquiry-001",
    "sender_id": "buyer-user-id",
    "sender_role": "buyer",
    "message": "The package was supposed to arrive yesterday but I haven't received it.",
    "created_at": "2024-01-15T10:07:00.000Z"
  }
}
```

**WebSocket Event (Both receive):**
```json
{
  "event": "message_received",
  "data": {
    "id": "message-002",
    "inquiry_id": "inquiry-001",
    "sender_id": "buyer-user-id",
    "sender_role": "buyer",
    "message": "The package was supposed to arrive yesterday but I haven't received it.",
    "created_at": "2024-01-15T10:07:00.000Z"
  }
}
```

**Result:** Message sent via WebSocket, persisted, and broadcast to all participants.

---

#### Step 7: Seller Joins Room
**WebSocket Event:**
```javascript
socket.emit('join_inquiry', {
  inquiry_id: 'inquiry-001',
  user_id: 'seller-user-id',
  user_role: 'seller'
});
```

**Server Events:**
- Seller receives: `{success: true, ...}`
- Buyer and Admin receive: `user_joined` event

**Result:** All three participants are now in the room.

---

#### Step 8: Seller Uploads Shipping Document
**HTTP Request:**
```bash
POST /api/v1/inquiries/inquiry-001/attachments/upload
Content-Type: multipart/form-data

file: [shipping-receipt.pdf]
message_id: message-002
```

**Response:**
```json
{
  "id": "attachment-001",
  "inquiry_id": "inquiry-001",
  "message_id": "message-002",
  "file_url": "https://bucket.s3.amazonaws.com/escrowly-inquiries/inquiry-001/uuid.pdf",
  "file_type": "pdf",
  "created_at": "2024-01-15T10:10:00.000Z"
}
```

**WebSocket Event (All three receive):**
```json
{
  "event": "attachment_uploaded",
  "data": {
    "id": "attachment-001",
    "inquiry_id": "inquiry-001",
    "message_id": "message-002",
    "file_url": "https://bucket.s3.amazonaws.com/escrowly-inquiries/inquiry-001/uuid.pdf",
    "file_type": "pdf",
    "uploaded_by": "seller-user-id",
    "created_at": "2024-01-15T10:10:00.000Z"
  }
}
```

**Result:** File uploaded to S3, attachment record created, all participants notified.

---

#### Step 9: Admin Resolves Inquiry
**HTTP Request:**
```bash
POST /api/v1/admin/inquiries/inquiry-001/resolve
{
  "status": "Refund to Buyer",
  "resolution_note": "After reviewing the shipping documents, we confirm the package was not delivered. We will process a full refund to the buyer."
}
```

**Response:**
```json
{
  "id": "inquiry-001",
  "status": "closed",
  "updated_at": "2024-01-15T10:15:00.000Z"
}
```

**What Happens:**
1. Inquiry status updated to "closed"
2. Resolution message created in conversation
3. WebSocket event broadcast

**WebSocket Event (All three receive):**
```json
{
  "event": "inquiry_updated",
  "data": {
    "inquiry_id": "inquiry-001",
    "status": "closed",
    "updated_at": "2024-01-15T10:15:00.000Z",
    "update_type": "resolved"
  }
}
```

**Additional WebSocket Event (Resolution message):**
```json
{
  "event": "message_received",
  "data": {
    "id": "message-003",
    "inquiry_id": "inquiry-001",
    "sender_id": "admin-user-id",
    "sender_role": "admin",
    "message": "After reviewing the shipping documents, we confirm the package was not delivered. We will process a full refund to the buyer.",
    "created_at": "2024-01-15T10:15:00.000Z"
  }
}
```

**Result:** Inquiry resolved, all participants notified, resolution message visible in conversation.

---

## Summary

### HTTP APIs Summary

#### User/Buyer/Seller Endpoints
| Method | Endpoint | Purpose | WebSocket Event |
|--------|----------|---------|-----------------|
| POST | `/inquiries` | Create inquiry | None |
| GET | `/inquiries/:id` | Get inquiry | None |
| GET | `/inquiries/escrow/:escrowId` | Get by escrow | None |
| POST | `/inquiries/:id/messages` | Add message | `message_received` |
| GET | `/inquiries/:id/messages` | List messages | None |
| POST | `/inquiries/:id/attachments` | Add attachment | `attachment_uploaded` |
| POST | `/inquiries/:id/attachments/upload` | Upload file | `attachment_uploaded` |
| GET | `/inquiries/:id/attachments` | List attachments | None |

#### Admin Endpoints (Super Admin & Assigned Admin)
| Method | Endpoint | Purpose | Used By | WebSocket Event |
|--------|----------|---------|---------|-----------------|
| GET | `/admin/inquiries` | List all inquiries | **Super Admin** (views all) | None |
| GET | `/admin/inquiries/:id` | Get inquiry detail | **Super Admin** & **Assigned Admin** | None |
| POST | `/admin/inquiries/:id/assign` | Assign inquiry to admin | **Super Admin** only | `inquiry_updated` |
| POST | `/admin/inquiries/:id/resolve` | Resolve inquiry (close) | **Super Admin** & **Assigned Admin** | `inquiry_updated` + `message_received` |

**Note:** 
- **Super Admin** can view all inquiries, assign inquiries to other admins, and resolve any inquiry
- **Assigned Admin** can view their assigned inquiries and resolve them
- Only admins can resolve inquiries (users cannot close inquiries themselves)

### Admin Endpoints Usage by Role

| Endpoint | Super Admin | Assigned Admin | Events Triggered |
|----------|-------------|----------------|------------------|
| `GET /admin/inquiries` | ✅ View all inquiries | ❌ Not typically used | None |
| `GET /admin/inquiries/:id` | ✅ View any inquiry | ✅ View assigned inquiries | None |
| `POST /admin/inquiries/:id/assign` | ✅ Assign to any admin | ❌ Cannot assign | `inquiry_updated` (admin_assigned) |
| `POST /admin/inquiries/:id/resolve` | ✅ Resolve any inquiry | ✅ Resolve assigned inquiries | `inquiry_updated` (resolved) + `message_received` |

**Workflow:**
1. **Super Admin** views all open inquiries: `GET /admin/inquiries?status=open`
2. **Super Admin** can either:
   - Handle inquiry directly: `POST /admin/inquiries/:id/resolve`
   - Assign to another admin: `POST /admin/inquiries/:id/assign` → `assigned_admin_id` is set
3. **Assigned Admin** views their assigned inquiry: `GET /admin/inquiries/:id`
4. **Assigned Admin** resolves the inquiry: `POST /admin/inquiries/:id/resolve`

### WebSocket Events Summary

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join_inquiry` | Client → Server | Join conversation room |
| `leave_inquiry` | Client → Server | Leave conversation room |
| `send_message` | Client → Server | Send message via WebSocket |
| `typing_start` | Client → Server | Start typing indicator |
| `typing_stop` | Client → Server | Stop typing indicator |
| `message_received` | Server → Client | New message broadcast |
| `attachment_uploaded` | Server → Client | New attachment broadcast |
| `user_joined` | Server → Client | User joined room |
| `user_left` | Server → Client | User left room |
| `user_typing` | Server → Client | Typing indicator update |
| `inquiry_updated` | Server → Client | Inquiry status/assignment update |
| `error` | Server → Client | Error notification |

---

## Kafka Events

The Inquiry Service uses Kafka for event-driven communication with other services. It both **consumes** events from other services and **produces** events for other services to consume.

### Events Consumed (Incoming)

The Inquiry Service subscribes to these Kafka topics and reacts to events:

| Topic | Event | Source Service | Action Taken |
|-------|-------|----------------|--------------|
| `escrow.disputed` | `DisputeOpenedPayload` | Escrow Service | **Auto-creates inquiry** for the disputed escrow with a system message about the dispute |
| `escrow.resolved` | `DisputeResolvedPayload` | Escrow Service | **Auto-closes inquiry** and adds resolution message to the conversation |

**Example Flow:**
1. Buyer/Seller files dispute on escrow → Escrow Service publishes `escrow.disputed`
2. Inquiry Service receives event → Auto-creates inquiry with `assigned_admin_id: null`
3. Admin resolves dispute → Escrow Service publishes `escrow.resolved`
4. Inquiry Service receives event → Closes inquiry and adds resolution message

### Events Produced (Outgoing)

The Inquiry Service publishes these events to Kafka (using Transactional Outbox Pattern):

| Topic | Event | Triggered By | Payload Contains |
|-------|-------|--------------|------------------|
| `inquiry.created` | `InquiryCreatedPayload` | `POST /inquiries` | Inquiry details, creator, initial message |
| `inquiry.closed` | `InquiryClosedPayload` | `POST /inquiries/:id/close` (deprecated) | Inquiry ID, escrow ID, closed by, note |
| `inquiry.resolved` | `InquiryResolvedPayload` | `POST /admin/inquiries/:id/resolve` | Inquiry ID, escrow ID, resolution type, resolution note |
| `inquiry.assigned` | `InquiryAssignedPayload` | `POST /admin/inquiries/:id/assign` | Inquiry ID, escrow ID, admin ID, assigned by |
| `inquiry.message.added` | `InquiryMessageAddedPayload` | `POST /inquiries/:id/messages` | Message ID, inquiry ID, sender, message content |
| `inquiry.attachment.uploaded` | `InquiryAttachmentUploadedPayload` | `POST /inquiries/:id/attachments` | Attachment ID, inquiry ID, file URL, file type |

**Event Production Method:**
- All events are saved to the **outbox table** first (Transactional Outbox Pattern)
- An outbox processor service publishes them to Kafka asynchronously
- This ensures **eventual consistency** - events are never lost even if Kafka is temporarily unavailable

**Who Consumes These Events?**
- **Notification Service** - Sends email/SMS notifications when inquiries are created, assigned, or resolved
- **Analytics Service** - Tracks inquiry metrics and admin performance
- **Admin Dashboard** - Real-time updates when inquiries are created or assigned
- **Other Services** - Can subscribe to inquiry events for their own business logic

---

## Quick Reference

### Base URLs
- **HTTP API:** `http://localhost:3003/api/v1`
- **WebSocket:** `ws://localhost:3003/inquiry`

### Common Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Validation error
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource

### File Upload Limits
- **Max Size:** 10MB
- **Supported Types:** Images (JPEG, PNG, WebP, GIF), Documents (PDF, DOC, DOCX), Spreadsheets (XLS, XLSX), Text (TXT)

---

## Complete Service Working Flow

### Service Architecture Overview

The Inquiry Service is built with the following components:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           INQUIRY SERVICE (Port 3003)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────────┐│
│  │ InquiryController│   │  InquiryGateway  │   │ InquiryConsumerService       ││
│  │   (HTTP REST)    │   │   (WebSocket)    │   │   (Kafka Consumer)           ││
│  └────────┬─────────┘   └────────┬─────────┘   └──────────────┬───────────────┘│
│           │                      │                            │                 │
│           └──────────────────────┼────────────────────────────┘                 │
│                                  │                                              │
│                                  ▼                                              │
│                       ┌──────────────────────┐                                  │
│                       │   InquiryService     │                                  │
│                       │  (Business Logic)    │                                  │
│                       └──────────┬───────────┘                                  │
│                                  │                                              │
│           ┌──────────────────────┼──────────────────────┐                       │
│           │                      │                      │                       │
│           ▼                      ▼                      ▼                       │
│  ┌────────────────┐   ┌──────────────────┐   ┌──────────────────┐              │
│  │ PrismaService  │   │InquiryEventProducer│  │    S3Service     │              │
│  │  (Database)    │   │ (Kafka Outbox)   │   │ (File Uploads)   │              │
│  └────────────────┘   └──────────────────┘   └──────────────────┘              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (inquiry_db)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────┐         ┌─────────────────────────────────────┐   │
│  │       inquiries         │         │        inquiry_messages             │   │
│  ├─────────────────────────┤         ├─────────────────────────────────────┤   │
│  │ id (PK)                 │◄────────│ inquiry_id (FK)                     │   │
│  │ escrow_id (UNIQUE)      │         │ id (PK)                             │   │
│  │ created_by              │         │ sender_id                           │   │
│  │ assigned_admin_id       │         │ sender_role (buyer|seller|admin)    │   │
│  │ status (open|closed)    │         │ message                             │   │
│  │ created_at              │         │ created_at                          │   │
│  │ updated_at              │         └─────────────────────────────────────┘   │
│  └─────────────────────────┘                          │                        │
│              │                                        │                        │
│              │                                        ▼                        │
│              │                         ┌─────────────────────────────────────┐ │
│              │                         │      inquiry_attachments           │ │
│              │                         ├─────────────────────────────────────┤ │
│              └────────────────────────►│ inquiry_id (FK)                     │ │
│                                        │ message_id (FK)                     │ │
│                                        │ id (PK)                             │ │
│                                        │ file_url                            │ │
│                                        │ file_type                           │ │
│                                        │ created_at                          │ │
│                                        └─────────────────────────────────────┘ │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        outbox_events (Transactional Outbox)              │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ id | topic | partitionKey | payload | status | retryCount | publishedAt │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Kafka Event Flow

### Events Consumed (Incoming from Escrow Service)

The Inquiry Service listens to these Kafka topics from the Escrow Service:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        KAFKA EVENT CONSUMPTION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ESCROW SERVICE                          INQUIRY SERVICE                         │
│  ═════════════                           ═══════════════                         │
│                                                                                  │
│  ┌─────────────────┐                     ┌─────────────────────────────────────┐│
│  │ Buyer/Seller    │                     │     InquiryConsumerService          ││
│  │ files dispute   │                     │                                     ││
│  └────────┬────────┘                     │  subscribeToDisputeEvents()         ││
│           │                              │   ├── escrow.disputed               ││
│           ▼                              │   └── escrow.resolved               ││
│  ┌─────────────────┐                     └──────────────┬──────────────────────┘│
│  │ Escrow Service  │                                    │                       │
│  │ fileDispute()   │                                    │                       │
│  └────────┬────────┘                                    │                       │
│           │                                             │                       │
│           ▼                                             ▼                       │
│  ┌─────────────────────┐    Kafka Topic    ┌─────────────────────────────────┐ │
│  │ escrow.disputed     │◄─────────────────►│ handleDisputeOpened()           │ │
│  │ {                   │                   │                                 │ │
│  │   escrowId,         │                   │  1. Check if inquiry exists     │ │
│  │   disputedBy,       │                   │  2. If not, create inquiry      │ │
│  │   reason,           │                   │  3. Add system message:         │ │
│  │   evidence          │                   │     "[SYSTEM] Dispute opened"   │ │
│  │ }                   │                   │  4. Status: open                │ │
│  └─────────────────────┘                   │  5. assigned_admin_id: null     │ │
│                                            └─────────────────────────────────┘ │
│                                                                                  │
│  ┌─────────────────────┐    Kafka Topic    ┌─────────────────────────────────┐ │
│  │ escrow.resolved     │◄─────────────────►│ handleDisputeResolved()         │ │
│  │ {                   │                   │                                 │ │
│  │   escrowId,         │                   │  1. Find inquiry by escrowId    │ │
│  │   resolution,       │                   │  2. Add resolution message      │ │
│  │   resolvedBy,       │                   │  3. Update status to "closed"   │ │
│  │   adminNotes        │                   │                                 │ │
│  │ }                   │                   └─────────────────────────────────┘ │
│  └─────────────────────┘                                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Events Produced (Outgoing to Other Services)

The Inquiry Service publishes these Kafka events using the Transactional Outbox Pattern:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        KAFKA EVENT PRODUCTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  INQUIRY SERVICE                                     KAFKA / OTHER SERVICES      │
│  ═══════════════                                     ═════════════════════       │
│                                                                                  │
│  ┌─────────────────────────────────────┐                                        │
│  │         InquiryService              │                                        │
│  │                                     │                                        │
│  │  createInquiry() ──────────────────►│───► inquiry.created                    │
│  │    └─ eventProducer.inquiryCreated()│                                        │
│  │                                     │                                        │
│  │  assignInquiry() ──────────────────►│───► inquiry.assigned                   │
│  │    └─ eventProducer.inquiryAssigned()│                                       │
│  │                                     │                                        │
│  │  resolveInquiry() ─────────────────►│───► inquiry.resolved                   │
│  │    └─ eventProducer.inquiryResolved()│                                       │
│  │                                     │                                        │
│  │  addMessage() ─────────────────────►│───► inquiry.message.added              │
│  │    └─ eventProducer.messageAdded()  │                                        │
│  │                                     │                                        │
│  │  addAttachment() ──────────────────►│───► inquiry.attachment.uploaded        │
│  │    └─ eventProducer.attachmentUploaded()                                     │
│  │                                     │                                        │
│  └─────────────────────────────────────┘                                        │
│                    │                                                            │
│                    ▼                                                            │
│  ┌─────────────────────────────────────┐     ┌────────────────────────────────┐│
│  │      InquiryEventProducer           │     │        OutboxEvent Table       ││
│  │                                     │     │                                ││
│  │  produce(topic, partitionKey, payload)    │  id: uuid                      ││
│  │        │                            │     │  topic: "inquiry.created"      ││
│  │        └─► outboxRepository.save()──┼────►│  partitionKey: inquiryId       ││
│  │                                     │     │  payload: {...}                ││
│  └─────────────────────────────────────┘     │  status: "pending"             ││
│                                              │  retryCount: 0                 ││
│                                              └────────────────────────────────┘│
│                                                           │                    │
│                                                           ▼                    │
│                                              ┌────────────────────────────────┐│
│                                              │   OutboxProcessorService       ││
│                                              │   (Background Worker)          ││
│                                              │                                ││
│                                              │  1. Poll pending events        ││
│                                              │  2. Publish to Kafka           ││
│                                              │  3. Mark as published          ││
│                                              │  4. Retry on failure           ││
│                                              └────────────────────────────────┘│
│                                                           │                    │
│                                                           ▼                    │
│                                              ┌────────────────────────────────┐│
│                                              │      KAFKA BROKER              ││
│                                              │                                ││
│                                              │  Topics:                       ││
│                                              │  - inquiry.created             ││
│                                              │  - inquiry.assigned            ││
│                                              │  - inquiry.resolved            ││
│                                              │  - inquiry.closed              ││
│                                              │  - inquiry.message.added       ││
│                                              │  - inquiry.attachment.uploaded ││
│                                              └────────────────────────────────┘│
│                                                           │                    │
│                                                           ▼                    │
│                                              ┌────────────────────────────────┐│
│                                              │     CONSUMER SERVICES          ││
│                                              │                                ││
│                                              │  - Notification Service        ││
│                                              │    (sends emails/SMS)          ││
│                                              │  - Analytics Service           ││
│                                              │    (tracks metrics)            ││
│                                              │  - Admin Dashboard             ││
│                                              │    (real-time updates)         ││
│                                              └────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete End-to-End Workflow

### Flow 1: Escrow Disputed → Inquiry Created → Admin Resolves

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DISPUTE RESOLUTION WORKFLOW                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  STEP 1: DISPUTE FILED                                                          │
│  ═══════════════════════                                                        │
│                                                                                  │
│  Buyer/Seller ──► Escrow Service ──► Kafka (escrow.disputed)                    │
│       │                                       │                                 │
│       │                                       ▼                                 │
│       │                           Inquiry Service receives event                │
│       │                                       │                                 │
│       │                                       ▼                                 │
│       │                           InquiryConsumerService                        │
│       │                           handleDisputeOpened()                         │
│       │                                       │                                 │
│       │                                       ▼                                 │
│       │                           ┌───────────────────────┐                     │
│       │                           │  CREATE INQUIRY       │                     │
│       │                           │  - escrow_id          │                     │
│       │                           │  - created_by         │                     │
│       │                           │  - status: open       │                     │
│       │                           │  - assigned_admin: null│                    │
│       │                           │                       │                     │
│       │                           │  CREATE MESSAGE       │                     │
│       │                           │  - sender: system     │                     │
│       │                           │  - "[SYSTEM] Dispute" │                     │
│       │                           └───────────────────────┘                     │
│                                                                                  │
│  STEP 2: BUYER/SELLER JOINS CONVERSATION                                        │
│  ═══════════════════════════════════════════                                    │
│                                                                                  │
│  User ──► WebSocket: join_inquiry { inquiry_id, user_id, user_role }            │
│       │                                                                         │
│       │   Response: { success: true, participants: [...] }                      │
│       │                                                                         │
│       └──► WebSocket: send_message { message, sender_id, sender_role }          │
│                                       │                                         │
│                                       ▼                                         │
│                           InquiryGateway broadcasts to room                     │
│                           All participants receive: message_received            │
│                                                                                  │
│  STEP 3: SUPER ADMIN VIEWS INQUIRIES                                            │
│  ═══════════════════════════════════════                                        │
│                                                                                  │
│  Super Admin ──► GET /admin/inquiries?status=open                               │
│       │                                                                         │
│       │   Response: List of all open inquiries                                  │
│       │   (includes inquiries with assigned_admin_id: null)                     │
│       │                                                                         │
│       └──► GET /admin/inquiries/:id                                             │
│            Response: Full inquiry details with all messages/attachments         │
│                                                                                  │
│  STEP 4: SUPER ADMIN ASSIGNS TO ADMIN                                           │
│  ═════════════════════════════════════                                          │
│                                                                                  │
│  Super Admin ──► POST /admin/inquiries/:id/assign { admin_id }                  │
│       │                                                                         │
│       │   InquiryService.assignInquiry()                                        │
│       │     └─► Update inquiry.assigned_admin_id                                │
│       │     └─► Publish: inquiry.assigned (Kafka)                               │
│       │     └─► WebSocket: inquiry_updated (update_type: admin_assigned)        │
│       │                                                                         │
│       │   Response: { id, assigned_admin_id: "admin-id", ... }                  │
│                                                                                  │
│  STEP 5: ASSIGNED ADMIN JOINS CONVERSATION                                      │
│  ════════════════════════════════════════════                                   │
│                                                                                  │
│  Assigned Admin ──► WebSocket: join_inquiry { inquiry_id, user_role: admin }    │
│       │                                                                         │
│       │   Now sees all messages from buyer/seller                               │
│       │                                                                         │
│       └──► WebSocket: send_message { message: "How can I help?" }               │
│            All participants receive: message_received                           │
│                                                                                  │
│  STEP 6: ADMIN RESOLVES INQUIRY                                                 │
│  ════════════════════════════════                                               │
│                                                                                  │
│  Admin ──► POST /admin/inquiries/:id/resolve                                    │
│       │   {                                                                     │
│       │     status: "Refund to Buyer",                                          │
│       │     resolution_note: "Buyer refunded due to non-delivery"               │
│       │   }                                                                     │
│       │                                                                         │
│       │   InquiryService.resolveInquiry()                                       │
│       │     └─► Update inquiry.status = "closed"                                │
│       │     └─► Create message with resolution note                             │
│       │     └─► Publish: inquiry.resolved (Kafka)                               │
│       │     └─► WebSocket: inquiry_updated (update_type: resolved)              │
│       │                                                                         │
│       │   Response: { id, status: "closed", ... }                               │
│                                                                                  │
│  RESULT: Inquiry closed, all participants notified via WebSocket                │
│          Notification Service can send email to buyer/seller                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Flow 2: Manual Inquiry Creation (Without Dispute)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MANUAL INQUIRY CREATION WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  STEP 1: USER CREATES INQUIRY                                                   │
│  ═══════════════════════════════                                                │
│                                                                                  │
│  Buyer/Seller ──► POST /inquiries                                               │
│       │           {                                                             │
│       │             escrow_id: "escrow-123",                                    │
│       │             created_by: "user-id",                                      │
│       │             initial_message: "I have a question"                        │
│       │           }                                                             │
│       │                                                                         │
│       │   InquiryService.createInquiry()                                        │
│       │     └─► Create inquiry record                                           │
│       │     └─► Create initial message (optional)                               │
│       │     └─► Publish: inquiry.created (Kafka)                                │
│       │                                                                         │
│       │   Response:                                                             │
│       │   {                                                                     │
│       │     id: "inquiry-id",                                                   │
│       │     escrow_id: "escrow-123",                                            │
│       │     assigned_admin_id: null,    ◄── No admin assigned yet              │
│       │     status: "open"                                                      │
│       │   }                                                                     │
│                                                                                  │
│  STEP 2: USER JOINS WEBSOCKET                                                   │
│  ════════════════════════════════                                               │
│                                                                                  │
│  User ──► WebSocket: join_inquiry { inquiry_id, user_id, user_role: buyer }     │
│                                                                                  │
│  STEP 3: USER UPLOADS ATTACHMENT                                                │
│  ═══════════════════════════════                                                │
│                                                                                  │
│  User ──► POST /inquiries/:id/attachments/upload                                │
│       │   multipart/form-data: { file, message_id }                             │
│       │                                                                         │
│       │   1. Upload to S3                                                       │
│       │   2. Create attachment record                                           │
│       │   3. WebSocket: attachment_uploaded                                     │
│       │                                                                         │
│       │   Response: { id, file_url, file_type }                                 │
│                                                                                  │
│  STEP 4-6: Same as Flow 1 (Admin views, assigns, resolves)                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Components Summary

| Component | Responsibility |
|-----------|----------------|
| **InquiryController** | HTTP REST API endpoints for CRUD operations |
| **InquiryService** | Business logic, database operations, event production |
| **InquiryGateway** | WebSocket real-time communication (Socket.IO) |
| **InquiryConsumerService** | Kafka event consumption (listens to escrow events) |
| **InquiryEventProducer** | Kafka event production (writes to outbox) |
| **OutboxRepository** | Transactional outbox pattern implementation |
| **PrismaService** | Database access layer (PostgreSQL) |
| **S3Service** | File uploads to AWS S3 |

---

## Event Summary Table

| Event | Direction | Trigger | Action |
|-------|-----------|---------|--------|
| `escrow.disputed` | **Consume** | Escrow Service: dispute filed | Auto-create inquiry |
| `escrow.resolved` | **Consume** | Escrow Service: dispute resolved | Auto-close inquiry |
| `inquiry.created` | **Produce** | POST /inquiries | Notify other services |
| `inquiry.assigned` | **Produce** | POST /admin/inquiries/:id/assign | Notify assigned admin |
| `inquiry.resolved` | **Produce** | POST /admin/inquiries/:id/resolve | Notify all parties |
| `inquiry.closed` | **Produce** | POST /inquiries/:id/close (deprecated) | Notify all parties |
| `inquiry.message.added` | **Produce** | POST /inquiries/:id/messages | Notify about new message |
| `inquiry.attachment.uploaded` | **Produce** | POST /inquiries/:id/attachments | Notify about new attachment |

---

**End of Reference Guide**

