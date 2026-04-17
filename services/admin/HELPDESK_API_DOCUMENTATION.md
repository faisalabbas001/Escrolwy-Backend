# Help Desk API Documentation

## Overview

The Help Desk API provides comprehensive CRUD operations for managing help desk categories and questions. This API allows administrators to organize FAQs into categories, manage questions and answers, and track user engagement metrics.

## Base URL

```
http://localhost:3002/api/v1/help-desk
```

## Features

- **Category Management**: Create, read, update, and delete help desk categories
- **Question Management**: Create, read, update, and delete questions within categories
- **Question Tracking**: Automatic view count tracking when questions are viewed
- **User Feedback**: Track helpful/not helpful feedback for questions
- **Flexible Organization**: Support for ordering categories and questions
- **Active/Inactive Status**: Control visibility of categories and questions

## Database Schema

### HelpDeskCategory Model

```prisma
model HelpDeskCategory {
  id          String            @id @default(uuid())
  name        String            @unique
  slug        String            @unique
  description String?
  order       Int               @default(0)
  isActive    Boolean           @default(true)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  createdBy   String?
  questions   HelpDeskQuestion[]
}
```

### HelpDeskQuestion Model

```prisma
model HelpDeskQuestion {
  id              String            @id @default(uuid())
  categoryId      String
  question        String
  answer          String
  order           Int               @default(0)
  isActive        Boolean           @default(true)
  viewCount       Int               @default(0)
  helpfulCount    Int               @default(0)
  notHelpfulCount Int               @default(0)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  createdBy       String?
  category        HelpDeskCategory  @relation(...)
}
```

## API Endpoints

### Category Endpoints

#### 1. Create Category

**POST** `/help-desk/categories`

Create a new help desk category.

**Request Body:**
```json
{
  "name": "Getting Started",
  "slug": "getting-started",
  "description": "Learn how to get started with Escrowly",
  "order": 1,
  "isActive": true
}
```

**Response:** `201 Created`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Getting Started",
  "slug": "getting-started",
  "description": "Learn how to get started with Escrowly",
  "order": 1,
  "isActive": true,
  "questionCount": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 2. Get All Categories

**GET** `/help-desk/categories?includeInactive=false`

Get all help desk categories.

**Query Parameters:**
- `includeInactive` (optional, boolean): Include inactive categories (default: false)

**Response:** `200 OK`
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Getting Started",
    "slug": "getting-started",
    "description": "Learn how to get started with Escrowly",
    "order": 1,
    "isActive": true,
    "questionCount": 4,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### 3. Get Category by ID

**GET** `/help-desk/categories/:id`

Get a specific category by its ID.

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Getting Started",
  "slug": "getting-started",
  "description": "Learn how to get started with Escrowly",
  "order": 1,
  "isActive": true,
  "questionCount": 4,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 4. Get Category by Slug (with Questions)

**GET** `/help-desk/categories/slug/:slug`

Get a category by its slug, including all active questions.

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Getting Started",
  "slug": "getting-started",
  "description": "Learn how to get started with Escrowly",
  "order": 1,
  "isActive": true,
  "questionCount": 4,
  "questions": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "categoryId": "123e4567-e89b-12d3-a456-426614174000",
      "question": "How does Escrowly work for buyers and sellers?",
      "answer": "Escrowly acts as a secure intermediary...",
      "order": 1,
      "isActive": true,
      "viewCount": 42,
      "helpfulCount": 35,
      "notHelpfulCount": 2,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 5. Update Category

**PATCH** `/help-desk/categories/:id`

Update a category. All fields are optional.

**Request Body:**
```json
{
  "description": "Updated description",
  "order": 2,
  "isActive": false
}
```

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Getting Started",
  "slug": "getting-started",
  "description": "Updated description",
  "order": 2,
  "isActive": false,
  "questionCount": 4,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

#### 6. Delete Category

**DELETE** `/help-desk/categories/:id`

Delete a category. **Note:** Categories with questions cannot be deleted.

**Response:** `204 No Content`

**Error Response:** `400 Bad Request`
```json
{
  "statusCode": 400,
  "message": "Cannot delete category with 4 question(s). Please delete or move questions first."
}
```

### Question Endpoints

#### 1. Create Question

**POST** `/help-desk/questions`

Create a new question in a category.

**Request Body:**
```json
{
  "categoryId": "123e4567-e89b-12d3-a456-426614174000",
  "question": "How does Escrowly work for buyers and sellers?",
  "answer": "Escrowly acts as a secure intermediary between buyers and sellers...",
  "order": 1,
  "isActive": true
}
```

**Response:** `201 Created`
```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "categoryId": "123e4567-e89b-12d3-a456-426614174000",
  "question": "How does Escrowly work for buyers and sellers?",
  "answer": "Escrowly acts as a secure intermediary...",
  "order": 1,
  "isActive": true,
  "viewCount": 0,
  "helpfulCount": 0,
  "notHelpfulCount": 0,
  "category": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Getting Started",
    "slug": "getting-started"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 2. Get All Questions

**GET** `/help-desk/questions?categoryId=xxx&includeInactive=false`

Get all questions, optionally filtered by category.

**Query Parameters:**
- `categoryId` (optional, string): Filter by category ID
- `includeInactive` (optional, boolean): Include inactive questions (default: false)

**Response:** `200 OK`
```json
[
  {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "categoryId": "123e4567-e89b-12d3-a456-426614174000",
    "question": "How does Escrowly work for buyers and sellers?",
    "answer": "Escrowly acts as a secure intermediary...",
    "order": 1,
    "isActive": true,
    "viewCount": 42,
    "helpfulCount": 35,
    "notHelpfulCount": 2,
    "category": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Getting Started",
      "slug": "getting-started"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### 3. Get Question by ID

**GET** `/help-desk/questions/:id`

Get a specific question by its ID. **Note:** This endpoint automatically increments the view count.

**Response:** `200 OK`
```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "categoryId": "123e4567-e89b-12d3-a456-426614174000",
  "question": "How does Escrowly work for buyers and sellers?",
  "answer": "Escrowly acts as a secure intermediary between buyers and sellers. When a transaction is initiated, the buyer sends payment to Escrowly, which holds the funds securely until the seller delivers the goods or services. Once both parties confirm satisfaction, Escrowly releases the funds to the seller.",
  "order": 1,
  "isActive": true,
  "viewCount": 43,
  "helpfulCount": 35,
  "notHelpfulCount": 2,
  "category": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Getting Started",
    "slug": "getting-started"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 4. Update Question

**PATCH** `/help-desk/questions/:id`

Update a question. All fields are optional.

**Request Body:**
```json
{
  "question": "Updated question text",
  "answer": "Updated answer text",
  "order": 2,
  "isActive": false,
  "categoryId": "789e0123-e89b-12d3-a456-426614174002"
}
```

**Response:** `200 OK`
```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "categoryId": "789e0123-e89b-12d3-a456-426614174002",
  "question": "Updated question text",
  "answer": "Updated answer text",
  "order": 2,
  "isActive": false,
  "viewCount": 43,
  "helpfulCount": 35,
  "notHelpfulCount": 2,
  "category": {
    "id": "789e0123-e89b-12d3-a456-426614174002",
    "name": "Security",
    "slug": "security"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

#### 5. Delete Question

**DELETE** `/help-desk/questions/:id`

Delete a question.

**Response:** `204 No Content`

### Feedback Endpoints

#### 1. Mark Question as Helpful

**POST** `/help-desk/questions/:id/helpful`

Record that a user found the question helpful.

**Response:** `200 OK`
```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "helpfulCount": 36,
  ...
}
```

#### 2. Mark Question as Not Helpful

**POST** `/help-desk/questions/:id/not-helpful`

Record that a user did not find the question helpful.

**Response:** `200 OK`
```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "notHelpfulCount": 3,
  ...
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Category with slug 'getting-started' already exists",
  "error": "Bad Request"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Category with ID '123e4567-e89b-12d3-a456-426614174000' not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## Usage Examples

### Example 1: Create a Category and Add Questions

```bash
# 1. Create a category
curl -X POST http://localhost:3002/api/v1/help-desk/categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Getting Started",
    "slug": "getting-started",
    "description": "Learn how to get started with Escrowly",
    "order": 1
  }'

# 2. Get the category ID from the response, then create questions
curl -X POST http://localhost:3002/api/v1/help-desk/questions \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "123e4567-e89b-12d3-a456-426614174000",
    "question": "How does Escrowly work?",
    "answer": "Escrowly acts as a secure intermediary...",
    "order": 1
  }'
```

### Example 2: Get Category with Questions

```bash
curl http://localhost:3002/api/v1/help-desk/categories/slug/getting-started
```

### Example 3: View a Question (increments view count)

```bash
curl http://localhost:3002/api/v1/help-desk/questions/456e7890-e89b-12d3-a456-426614174001
```

### Example 4: Provide Feedback

```bash
# Mark as helpful
curl -X POST http://localhost:3002/api/v1/help-desk/questions/456e7890-e89b-12d3-a456-426614174001/helpful

# Mark as not helpful
curl -X POST http://localhost:3002/api/v1/help-desk/questions/456e7890-e89b-12d3-a456-426614174001/not-helpful
```

## Testing

Run the test script to verify all endpoints:

```bash
./test-help-desk-api.sh
```

Or manually:

```bash
npx ts-node src/test/test-help-desk-api.ts
```

## Swagger Documentation

Once the service is running, visit:

```
http://localhost:3002/api/docs
```

Navigate to the "Help Desk" section to see interactive API documentation.

## Notes

1. **Slug Uniqueness**: Category slugs must be unique and URL-friendly
2. **Cascade Deletion**: Deleting a category will delete all its questions (if allowed)
3. **View Tracking**: View count is automatically incremented when a question is fetched by ID
4. **Ordering**: Categories and questions are sorted by `order` field, then by name/question text
5. **Active Status**: Only active categories and questions are returned by default (unless `includeInactive=true`)

