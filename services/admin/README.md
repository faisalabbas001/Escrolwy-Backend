# Admin Service - Complete API Documentation

Administration microservice for the Escrowly platform providing comprehensive APIs for blog management, help desk operations, file uploads, and system health monitoring.

## 📋 Overview

The Admin Service provides **36 REST API endpoints** organized into 5 main modules:

- **Health Check APIs** (3 endpoints) - Service monitoring and health status
- **Blog Management APIs** (11 endpoints) - Complete CRUD for blog posts and categories
- **Help Desk APIs** (20 endpoints) - Categories, questions, and unified item management
- **File Upload APIs** (2 endpoints) - Image upload to AWS S3
- **Root API** (1 endpoint) - Service information

**Base URL**: `http://localhost:3002/api/v1`

**Swagger Documentation**: `http://localhost:3002/api/docs`

---

## 🏗️ Architecture

- **Framework**: NestJS (TypeScript)
- **ORM**: Prisma
- **Database**: PostgreSQL (admin_db schema)
- **File Storage**: AWS S3
- **Documentation**: Swagger/OpenAPI
- **API Versioning**: URI-based (`/api/v1/...`)

---

## 📊 API Summary

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Health | 3 | Service health, readiness, and liveness checks |
| Blog | 11 | Blog post CRUD, categories, and filtering |
| Help Desk | 20 | Categories, questions, and unified item management |
| Upload | 2 | Single and multiple image uploads to S3 |
| Root | 1 | Service hello endpoint |
| **Total** | **36** | **All administrative APIs** |

---

## 🔍 1. Health Check APIs (3 Endpoints)

### 1.1 Health Check
**GET** `/api/v1/health`

Returns basic service health status.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "service": "admin-service",
  "timestamp": "2025-12-02T10:00:00.000Z"
}
```

---

### 1.2 Readiness Check
**GET** `/api/v1/health/ready`

Checks if service is ready to accept traffic (includes database connectivity check).

**Response:** `200 OK` (ready) or `503 Service Unavailable` (not ready)
```json
{
  "status": "ready",
  "service": "admin-service",
  "timestamp": "2025-12-02T10:00:00.000Z"
}
```

---

### 1.3 Liveness Check
**GET** `/api/v1/health/live`

Returns if service is alive (even if not ready).

**Response:** `200 OK`
```json
{
  "status": "alive",
  "service": "admin-service",
  "timestamp": "2025-12-02T10:00:00.000Z"
}
```

---

## 📰 2. Blog Management APIs (11 Endpoints)

### 2.1 Create Blog Post
**POST** `/api/v1/admin/blogs`

Create a new blog post (Admin only, requires JWT authentication).

**Request Body:**
```json
{
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "Crypto Escrow",
  "imageUrl": "https://example.com/blog-image.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions...",
  "readTime": 4,
  "isPublished": true,
  "contentSections": [
    {
      "title": "How Escrowly Ensures Safe Transactions",
      "description": "Escrowly offers a reliable and secure platform...",
      "imageUrl": "https://example.com/section-image.jpg",
      "subsections": [
        {
          "title": "Benefits of Using Escrowly",
          "description": "Escrowly offers a reliable and secure platform...",
          "imageUrl": "https://example.com/subsection-image.jpg"
        }
      ]
    }
  ],
  "createdBy": "admin-user-id"
}
```

**Response:** `201 Created`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "Crypto Escrow",
  "imageUrl": "https://example.com/blog-image.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions...",
  "readTime": 4,
  "isPublished": true,
  "createdAt": "2024-12-27T00:00:00.000Z",
  "updatedAt": "2024-12-27T00:00:00.000Z",
  "contentSections": [...]
}
```

**How it works:**
1. Validates category exists in database
2. Creates blog post with category relation
3. Returns complete blog data with category name

---

### 2.2 Get All Blogs
**GET** `/api/v1/admin/blogs`

Get paginated list of blogs with optional filtering.

**Query Parameters:**
- `category` (optional): Filter by category name (e.g., "Crypto Escrow")
- `published` (optional): Filter by published status (`true`/`false`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Example Request:**
```
GET /api/v1/admin/blogs?category=Crypto Escrow&published=true&page=1&limit=10
```

**Response:** `200 OK`
```json
{
  "blogs": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "How Escrowly Ensures Safe Transactions",
      "slug": "how-escrowly-ensures-safe-transactions",
      "category": "Crypto Escrow",
      "imageUrl": "https://example.com/blog-image.jpg",
      "excerpt": "Learn how Escrowly provides secure crypto transactions...",
      "readTime": 4,
      "isPublished": true,
      "createdAt": "December 27, 2024",
      "publishedDate": "December 27, 2024"
    }
  ],
  "total": 37,
  "page": 1,
  "limit": 10,
  "totalPages": 4
}
```

---

### 2.3 Get Blog by ID
**GET** `/api/v1/admin/blogs/:id`

Get a single blog post by UUID.

**Path Parameters:**
- `id` (required): Blog UUID

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "Crypto Escrow",
  "imageUrl": "https://example.com/blog-image.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions...",
  "readTime": 4,
  "isPublished": true,
  "contentSections": [...],
  "createdAt": "2024-12-27T00:00:00.000Z",
  "updatedAt": "2024-12-27T00:00:00.000Z"
}
```

---

### 2.4 Get Blog by Slug
**GET** `/api/v1/admin/blogs/slug/:slug`

Get a blog post by slug (used by frontend blog details page).

**Path Parameters:**
- `slug` (required): Blog slug (URL-friendly identifier)

**Example Request:**
```
GET /api/v1/admin/blogs/slug/how-escrowly-ensures-safe-transactions
```

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "Crypto Escrow",
  "imageUrl": "https://example.com/blog-image.jpg",
  "contentSections": [
    {
      "title": "How Escrowly Ensures Safe Transactions",
      "description": "Full content...",
      "imageUrl": "https://example.com/section-image.jpg"
    }
  ],
  "createdAt": "December 27, 2024"
}
```

---

### 2.5 Get Blog Categories with Count
**GET** `/api/v1/admin/blogs/categories`

Get all blog categories with post count.

**Response:** `200 OK`
```json
[
  {
    "category": {
      "id": 1,
      "name": "Crypto Escrow"
    },
    "count": 15
  },
  {
    "category": {
      "id": 2,
      "name": "Security"
    },
    "count": 8
  }
]
```

---

### 2.6 Get Blog Categories for Dropdown
**GET** `/api/v1/admin/blogs/categories/dropdown`

Get all blog categories formatted for dropdown selection (id and name only).

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Crypto Escrow"
  },
  {
    "id": 2,
    "name": "Security"
  },
  {
    "id": 3,
    "name": "Real Estate Escrow"
  }
]
```

---

### 2.7 Get All Blog Categories
**GET** `/api/v1/admin/blogs/categories/all`

Get all blog categories with full details.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Crypto Escrow",
    "slug": "crypto-escrow",
    "createdAt": "2025-12-02T10:00:00.000Z",
    "updatedAt": "2025-12-02T10:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Security",
    "slug": "security",
    "createdAt": "2025-12-02T10:00:00.000Z",
    "updatedAt": "2025-12-02T10:00:00.000Z"
  }
]
```

---

### 2.8 Create Blog Category
**POST** `/api/v1/admin/blogs/categories/simple`

Create a blog category with just a name (slug auto-generated).

**Request Body:**
```json
{
  "category": "New Category Name"
}
```

**Response:** `201 Created`
```json
{
  "id": 5,
  "name": "New Category Name"
}
```

**How it works:**
1. Auto-generates slug from category name
2. Checks for duplicates (by name or slug)
3. Creates category in database
4. Returns id and name only

---

### 2.9 Update Blog Post
**PATCH** `/api/v1/admin/blogs/:id`

Update a blog post (Admin only, all fields optional for partial updates).

**Path Parameters:**
- `id` (required): Blog UUID

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "category": "Security",
  "isPublished": true,
  "contentSections": [...]
}
```

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Updated Title",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "Security",
  "updatedAt": "2024-12-27T01:00:00.000Z",
  ...
}
```

---

### 2.10 Delete Blog Post
**DELETE** `/api/v1/admin/blogs/:id`

Delete a blog post (Admin only).

**Path Parameters:**
- `id` (required): Blog UUID

**Response:** `204 No Content`

---

## 🆘 3. Help Desk APIs (20 Endpoints)

The Help Desk module provides three types of APIs:
- **Category APIs** (8 endpoints) - Manage help desk categories
- **Question APIs** (6 endpoints) - Manage individual questions
- **Unified Item APIs** (5 endpoints) - Manage help desk items with nested questions
- **Simple Category API** (1 endpoint) - Quick category creation

### 3.1 Category APIs (8 Endpoints)

#### 3.1.1 Create Category
**POST** `/api/v1/admin/help-desk/categories`

Create a new help desk category.

**Request Body:**
```json
{
  "title": "Account Support",
  "slug": "account-support"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "title": "Account Support",
  "slug": "account-support",
  "createdAt": "2025-12-02T10:00:00.000Z",
  "updatedAt": "2025-12-02T10:00:00.000Z",
  "itemCount": 0
}
```

---

#### 3.1.2 Get All Categories
**GET** `/api/v1/admin/help-desk/categories`

Get all help desk categories.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "Food",
    "slug": "food",
    "createdAt": "2025-12-02T10:00:00.000Z",
    "updatedAt": "2025-12-02T10:00:00.000Z",
    "itemCount": 5
  }
]
```

---

#### 3.1.3 Get Categories for Dropdown
**GET** `/api/v1/admin/help-desk/categories/dropdown`

Get categories formatted for dropdown selection (id and name only).

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Food"
  },
  {
    "id": 2,
    "name": "Fruits"
  }
]
```

---

#### 3.1.4 Create Category Simple
**POST** `/api/v1/admin/help-desk/categories/simple`

Create a category with just a name (slug auto-generated).

**Request Body:**
```json
{
  "category": "New Category Name"
}
```

**Response:** `201 Created`
```json
{
  "id": 5,
  "name": "New Category Name"
}
```

---

#### 3.1.5 Get Category by ID
**GET** `/api/v1/admin/help-desk/categories/:id`

Get a single category by ID.

**Path Parameters:**
- `id` (required): Category ID (number)

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Food",
  "slug": "food",
  "createdAt": "2025-12-02T10:00:00.000Z",
  "updatedAt": "2025-12-02T10:00:00.000Z",
  "itemCount": 5
}
```

---

#### 3.1.6 Get Category by Slug
**GET** `/api/v1/admin/help-desk/categories/slug/:slug`

Get a category by slug with all associated items and questions.

**Path Parameters:**
- `slug` (required): Category slug

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Food",
  "slug": "food",
  "createdAt": "2025-12-02T10:00:00.000Z",
  "updatedAt": "2025-12-02T10:00:00.000Z",
  "items": [
    {
      "id": 1,
      "title": "How to reset password?",
      "slug": "how-to-reset-password",
      "questions": [
        {
          "id": 1,
          "question": "How do I reset my password?",
          "answer": "Go to settings and click on the reset password option.",
          "createdAt": "2025-12-02T10:00:00.000Z"
        }
      ]
    }
  ]
}
```

---

#### 3.1.7 Update Category
**PATCH** `/api/v1/admin/help-desk/categories/:id`

Update a category.

**Path Parameters:**
- `id` (required): Category ID (number)

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Category Name",
  "slug": "updated-category-slug"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Updated Category Name",
  "slug": "updated-category-slug",
  "updatedAt": "2025-12-02T11:00:00.000Z",
  ...
}
```

---

#### 3.1.8 Delete Category
**DELETE** `/api/v1/admin/help-desk/categories/:id`

Delete a category (cascades to items and questions).

**Path Parameters:**
- `id` (required): Category ID (number)

**Response:** `204 No Content`

---

### 3.2 Question APIs (6 Endpoints)

#### 3.2.1 Create Question
**POST** `/api/v1/admin/help-desk/questions`

Create a new help desk question (belongs to a help desk item).

**Request Body:**
```json
{
  "question": "How do I reset my password?",
  "answer": "Go to settings and click on the reset password option.",
  "itemId": 1
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "question": "How do I reset my password?",
  "answer": "Go to settings and click on the reset password option.",
  "itemId": 1,
  "createdAt": "2025-12-02T10:00:00.000Z",
  "updatedAt": "2025-12-02T10:00:00.000Z"
}
```

---

#### 3.2.2 Get All Questions
**GET** `/api/v1/admin/help-desk/questions`

Get all questions with optional filtering.

**Query Parameters:**
- `categoryId` (optional): Filter by category ID

**Example Request:**
```
GET /api/v1/admin/help-desk/questions?categoryId=1
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "question": "How do I reset my password?",
    "answer": "Go to settings and click on the reset password option.",
    "itemId": 1,
    "createdAt": "2025-12-02T10:00:00.000Z",
    "updatedAt": "2025-12-02T10:00:00.000Z"
  }
]
```

---

#### 3.2.3 Get Question by ID
**GET** `/api/v1/admin/help-desk/questions/:id`

Get a single question by ID.

**Path Parameters:**
- `id` (required): Question ID (number)

**Response:** `200 OK`
```json
{
  "id": 1,
  "question": "How do I reset my password?",
  "answer": "Go to settings and click on the reset password option.",
  "itemId": 1,
  "createdAt": "2025-12-02T10:00:00.000Z",
  "updatedAt": "2025-12-02T10:00:00.000Z"
}
```

---

#### 3.2.4 Get Question by Slug
**GET** `/api/v1/admin/help-desk/questions/slug/:slug`

Get a question by slug (legacy endpoint).

**Path Parameters:**
- `slug` (required): Question slug

**Response:** `404 Not Found` (deprecated)

---

#### 3.2.5 Update Question
**PATCH** `/api/v1/admin/help-desk/questions/:id`

Update a question.

**Path Parameters:**
- `id` (required): Question ID (number)

**Request Body:** (all fields optional)
```json
{
  "question": "Updated question text?",
  "answer": "Updated answer text."
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "question": "Updated question text?",
  "answer": "Updated answer text.",
  "itemId": 1,
  "updatedAt": "2025-12-02T11:00:00.000Z",
  ...
}
```

---

#### 3.2.6 Delete Question
**DELETE** `/api/v1/admin/help-desk/questions/:id`

Delete a question.

**Path Parameters:**
- `id` (required): Question ID (number)

**Response:** `204 No Content`

---

### 3.3 Unified Help Desk Item APIs (5 Endpoints)

These are the **primary APIs** recommended for frontend use. They handle help desk items with nested questions in a single request.

#### 3.3.1 Create Help Desk Item (Unified)
**POST** `/api/v1/admin/help-desk`

Create a help desk item with multiple questions in a single transaction.

**Request Body:**
```json
{
  "title": "How to reset password?",
  "category": "Food",
  "questions": [
    {
      "question": "How do I reset my password?",
      "answer": "Go to settings and click on the reset password option."
    },
    {
      "question": "What if I forgot my email?",
      "answer": "Contact support with your account details."
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "title": "How to reset password?",
  "slug": "how-to-reset-password",
  "category": {
    "name": "Food"
  },
  "questions": [
    {
      "question": "How do I reset my password?",
      "answer": "Go to settings and click on the reset password option."
    },
    {
      "question": "What if I forgot my email?",
      "answer": "Contact support with your account details."
    }
  ],
  "createdAt": "2025-12-02T10:00:00.000Z"
}
```

**How it works:**
1. Auto-generates slug from title
2. Finds or validates category exists
3. Creates item in database
4. Creates all questions in a Prisma transaction
5. Returns complete item with category and questions

---

#### 3.3.2 Get All Help Desk Items (Unified)
**GET** `/api/v1/admin/help-desk`

Get all help desk items with nested category and questions (single API call).

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "How to reset password?",
    "slug": "how-to-reset-password",
    "category": {
      "name": "Food"
    },
    "questions": [
      {
        "question": "How do I reset my password?",
        "answer": "Go to settings and click on the reset password option."
      }
    ],
    "createdAt": "2025-12-02T10:00:00.000Z"
  }
]
```

**How it works:**
- Single database query with joins
- Includes category information
- Includes all questions for each item
- Ordered by creation date (newest first)
- No separate API calls needed

---

#### 3.3.3 Get Help Desk Item by ID
**GET** `/api/v1/admin/help-desk/item/:id`

Get a single help desk item with category and questions.

**Path Parameters:**
- `id` (required): Help desk item ID (number)

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "How to reset password?",
  "slug": "how-to-reset-password",
  "category": {
    "name": "Food"
  },
  "questions": [
    {
      "question": "How do I reset my password?",
      "answer": "Go to settings and click on the reset password option."
    }
  ],
  "createdAt": "2025-12-02T10:00:00.000Z"
}
```

---

#### 3.3.4 Update Help Desk Item
**PATCH** `/api/v1/admin/help-desk/item/:id`

Update a help desk item (can update title, category, and questions).

**Path Parameters:**
- `id` (required): Help desk item ID (number)

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "category": "Fruits",
  "questions": [
    {
      "question": "Updated question?",
      "answer": "Updated answer."
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "title": "Updated title",
  "slug": "updated-title",
  "category": {
    "name": "Fruits"
  },
  "questions": [
    {
      "question": "Updated question?",
      "answer": "Updated answer."
    }
  ],
  "updatedAt": "2025-12-02T11:00:00.000Z",
  ...
}
```

**How it works:**
1. Updates item title (auto-generates new slug if title changed)
2. Updates category if provided
3. Deletes old questions and creates new ones if questions array provided
4. All operations in a Prisma transaction

---

#### 3.3.5 Delete Help Desk Item
**DELETE** `/api/v1/admin/help-desk/item/:id`

Delete a help desk item (cascades to questions).

**Path Parameters:**
- `id` (required): Help desk item ID (number)

**Response:** `204 No Content`

---

## 📤 4. File Upload APIs (2 Endpoints)

### 4.1 Upload Single Image
**POST** `/api/v1/admin/upload/image`

Upload a single image to AWS S3 (requires JWT authentication).

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` (required): Image file (JPEG, PNG, WebP, max 5MB)
- `folder` (optional): S3 folder path (default: `escrowly-blogs`)

**Example using curl:**
```bash
curl -X POST http://localhost:3002/api/v1/admin/upload/image \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@image.jpg" \
  -F "folder=escrowly-blogs"
```

**Response:** `200 OK`
```json
{
  "url": "https://dev-escrowly-stack-devescrowlyfilesd7d0fc74-e0doc9ny2wst.s3.us-east-1.amazonaws.com/escrowly-blogs/image.jpg"
}
```

---

### 4.2 Upload Multiple Images
**POST** `/api/v1/admin/upload/images`

Upload multiple images to AWS S3 (max 10 files, requires JWT authentication).

**Content-Type:** `multipart/form-data`

**Form Data:**
- `files` (required): Array of image files (JPEG, PNG, WebP, max 5MB each)
- `folder` (optional): S3 folder path (default: `escrowly-blogs`)

**Example using curl:**
```bash
curl -X POST http://localhost:3002/api/v1/admin/upload/images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg" \
  -F "folder=escrowly-blogs"
```

**Response:** `200 OK`
```json
{
  "urls": [
    "https://dev-escrowly-stack-devescrowlyfilesd7d0fc74-e0doc9ny2wst.s3.us-east-1.amazonaws.com/escrowly-blogs/image1.jpg",
    "https://dev-escrowly-stack-devescrowlyfilesd7d0fc74-e0doc9ny2wst.s3.us-east-1.amazonaws.com/escrowly-blogs/image2.jpg"
  ]
}
```

---

## 🏠 5. Root API (1 Endpoint)

### 5.1 Service Hello
**GET** `/api/v1/`

Returns service information.

**Response:** `200 OK`
```
Admin Service is running
```

---

## 🔑 Authentication

Most endpoints require JWT authentication (except health checks and public blog endpoints).

**Header Format:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📊 Complete API Statistics Summary

| Category | Count | Endpoints |
|----------|-------|-----------|
| Health Checks | 3 | `/health`, `/health/ready`, `/health/live` |
| Blog Management | 11 | Create, List, Get by ID, Get by Slug, Categories (4), Update, Delete |
| Help Desk Categories | 8 | Create, List, Get by ID, Get by Slug, Dropdown, Simple Create, Update, Delete |
| Help Desk Questions | 6 | Create, List, Get by ID, Get by Slug, Update, Delete |
| Help Desk Items (Unified) | 5 | Create, List, Get by ID, Update, Delete |
| File Upload | 2 | Single image, Multiple images |
| Root | 1 | Service hello |
| **TOTAL** | **36** | **All administrative APIs** |

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.0.0
- Docker & Docker Compose
- npm >= 10.0.0
- PostgreSQL database
- AWS S3 bucket (for file uploads)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:dev

# Start development server
npm run start:dev
```

### Access Points
- **API**: http://localhost:3002/api/v1
- **Swagger Docs**: http://localhost:3002/api/docs
- **Health Check**: http://localhost:3002/api/v1/health

---

## 🧪 Testing APIs

### Using Swagger UI
1. Navigate to http://localhost:3002/api/docs
2. Click "Authorize" and enter your JWT token
3. Try out any endpoint directly from the browser

### Using curl

**Example: Get all help desk items**
```bash
curl http://localhost:3002/api/v1/admin/help-desk
```

**Example: Create blog category**
```bash
curl -X POST http://localhost:3002/api/v1/admin/blogs/categories/simple \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "category": "Crypto Escrow"
  }'
```

**Example: Create help desk item**
```bash
curl -X POST http://localhost:3002/api/v1/admin/help-desk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "How to reset password?",
    "category": "Food",
    "questions": [
      {
        "question": "How do I reset?",
        "answer": "Go to settings"
      }
    ]
  }'
```

---

## 📝 Database Schema

### Blog Models

**BlogCategory**
- `id` (Int, Primary Key)
- `name` (String, Unique)
- `slug` (String, Unique)
- `createdAt`, `updatedAt` (DateTime)

**Blog**
- `id` (UUID, Primary Key)
- `title` (String)
- `slug` (String, Unique)
- `categoryId` (Int, Foreign Key to BlogCategory)
- `imageUrl` (Text)
- `excerpt` (Text, Optional)
- `readTime` (Int)
- `isPublished` (Boolean)
- `contentSections` (JSON)
- `createdAt`, `updatedAt` (DateTime)

### Help Desk Models

**HelpDeskCategory**
- `id` (Int, Primary Key)
- `name` (String, Unique)
- `slug` (String, Unique)
- `createdAt`, `updatedAt` (DateTime)

**HelpDeskItem**
- `id` (Int, Primary Key)
- `title` (String)
- `slug` (String, Unique)
- `categoryId` (Int, Foreign Key)
- `createdAt`, `updatedAt` (DateTime)

**HelpDeskQuestion**
- `id` (Int, Primary Key)
- `question` (Text)
- `answer` (Text)
- `itemId` (Int, Foreign Key)
- `createdAt`, `updatedAt` (DateTime)

---

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Service port | `3002` |
| `DATABASE_URL` | PostgreSQL connection | Required |
| `AWS_ACCESS_KEY_ID` | AWS access key | Required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET` | S3 bucket name | Required |

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Swagger/OpenAPI Spec](https://swagger.io/specification/)

---

## ✅ API Best Practices

1. **Use Unified Help Desk APIs** - They reduce API calls and improve performance
2. **Always include JWT token** for authenticated endpoints
3. **Use proper HTTP methods** - GET for reads, POST for creates, PATCH for updates, DELETE for deletes
4. **Handle errors gracefully** - Check status codes and error messages
5. **Use pagination** for list endpoints when available
6. **Validate input** - The API validates all inputs automatically
7. **Use category dropdown endpoints** - They return optimized data for UI components

---

## 🎯 Key Features

### Blog Management
- ✅ Dynamic category management (create categories via API)
- ✅ Rich content sections with images
- ✅ Slug-based routing for SEO-friendly URLs
- ✅ Published/unpublished status control
- ✅ Pagination and filtering support

### Help Desk Management
- ✅ Unified API for creating items with questions in one call
- ✅ Category-based organization
- ✅ Single API call to get all items with nested data
- ✅ Simple category creation endpoint
- ✅ Full CRUD operations for all entities

### File Upload
- ✅ Single and multiple image uploads
- ✅ AWS S3 integration
- ✅ Configurable folder paths
- ✅ File size validation (max 5MB)

---

**Service Status**: ✅ Production Ready  
**Last Updated**: December 2, 2025  
**Total APIs**: 36 endpoints across 5 modules

