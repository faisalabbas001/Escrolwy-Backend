# 📰 Blog API Documentation

Complete API documentation for the Blog Management System in the Admin Service.

## 📋 Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Create Blog](#1-create-blog-post)
  - [Get All Blogs](#2-get-all-blogs)
  - [Get Blog Categories](#3-get-blog-categories)
  - [Get Blog by ID](#4-get-blog-by-id)
  - [Get Blog by Slug](#5-get-blog-by-slug-frontend-details-page)
  - [Update Blog](#6-update-blog-post)
  - [Delete Blog](#7-delete-blog-post)
- [Data Models](#data-models)
- [Error Responses](#error-responses)
- [Examples](#examples)

---

## Overview

The Blog API provides complete CRUD (Create, Read, Update, Delete) operations for managing blog posts. This API supports the frontend blog system and allows administrators to manage blog content, categories, and publication status.

**Features:**
- ✅ Create, read, update, and delete blog posts
- ✅ Category-based filtering
- ✅ Published/unpublished status management
- ✅ Pagination support
- ✅ Slug-based URLs for SEO
- ✅ Rich content sections with images
- ✅ Table of contents structure

---

## Base URL

```
Development: http://localhost:3002/api/v1
Production: https://admin-api.escrowly.com/api/v1
```

---

## Authentication

All endpoints require JWT authentication (Bearer token) except for public read operations.

**Header:**
```
Authorization: Bearer <your-jwt-token>
```

**Note:** Create, Update, and Delete operations require admin privileges.

---

## API Endpoints

### 1. Create Blog Post

Create a new blog post (Admin only).

**Endpoint:** `POST /api/v1/blogs`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "CRYPTO_ESCROW",
  "imageUrl": "https://example.com/blog-image.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions for businesses and individuals worldwide.",
  "readTime": 4,
  "isPublished": true,
  "contentSections": [
    {
      "title": "How Escrowly Ensures Safe Transactions",
      "description": "Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. By utilizing advanced technologies and best practices, Escrowly ensures that all parties involved in a transaction can have peace of mind.",
      "imageUrl": "https://example.com/section-1-image.jpg"
    },
    {
      "title": "Benefits of Using Escrowly",
      "description": "Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. Here's how Escrowly protects your interests:",
      "imageUrl": "https://example.com/section-2-image.jpg",
      "subsections": [
        {
          "title": "Fraud Prevention",
          "description": "Ensures that payments are only processed when conditions are met."
        },
        {
          "title": "Secure Crypto Transactions",
          "description": "Reduces the risks of scams in the volatile crypto market."
        },
        {
          "title": "Trust & Transparency",
          "description": "Builds confidence between buyers and sellers, fostering long-term business relationships."
        }
      ]
    },
    {
      "title": "Future-Proof Your Transactions with Escrowly",
      "description": "As digital transactions continue to evolve, businesses and individuals need a secure and reliable payment system that adapts to changing market conditions. Escrowly provides high-level security for cryptocurrency transactions and ensures your digital assets are protected."
    }
  ],
  "createdBy": "admin-user-id-123"
}
```

**Response:** `201 Created`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "CRYPTO_ESCROW",
  "imageUrl": "https://example.com/blog-image.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions for businesses and individuals worldwide.",
  "readTime": 4,
  "isPublished": true,
  "publishedAt": "2024-12-27T00:00:00.000Z",
  "createdAt": "2024-12-27T00:00:00.000Z",
  "updatedAt": "2024-12-27T00:00:00.000Z",
  "createdBy": "admin-user-id-123",
  "contentSections": [
    {
      "title": "How Escrowly Ensures Safe Transactions",
      "description": "Escrowly offers a reliable and secure platform...",
      "imageUrl": "https://example.com/section-1-image.jpg"
    },
    {
      "title": "Benefits of Using Escrowly",
      "description": "Escrowly offers a reliable and secure platform...",
      "imageUrl": "https://example.com/section-2-image.jpg",
      "subsections": [
        {
          "title": "Fraud Prevention",
          "description": "Ensures that payments are only processed when conditions are met."
        }
      ]
    }
  ]
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3002/api/v1/blogs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "How Escrowly Ensures Safe Transactions",
    "slug": "how-escrowly-ensures-safe-transactions",
    "category": "CRYPTO_ESCROW",
    "imageUrl": "https://example.com/blog-image.jpg",
    "excerpt": "Learn how Escrowly provides secure crypto transactions...",
    "readTime": 4,
    "isPublished": true,
    "contentSections": [...]
  }'
```

---

### 2. Get All Blogs

Get a paginated list of blogs with optional filtering.

**Endpoint:** `GET /api/v1/blogs`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Filter by category (see categories below) |
| `published` | boolean | No | Filter by published status (`true`/`false`) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 10) |

**Available Categories:**
- `CRYPTO_ESCROW`
- `SECURITY`
- `REAL_ESTATE_ESCROW`
- `DOMAIN_NAME_ESCROW`
- `BLOCKCHAIN_SECURITY`
- `CRYPTO_TRANSACTIONS`
- `FINANCE_SECURITY`

**Example Requests:**

Get all published blogs:
```
GET /api/v1/blogs?published=true
```

Get blogs by category:
```
GET /api/v1/blogs?category=CRYPTO_ESCROW&published=true
```

Get paginated results:
```
GET /api/v1/blogs?page=1&limit=10&published=true
```

**Response:** `200 OK`
```json
{
  "blogs": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "How Escrowly Ensures Safe Transactions",
      "slug": "how-escrowly-ensures-safe-transactions",
      "category": "CRYPTO_ESCROW",
      "imageUrl": "https://example.com/blog-image.jpg",
      "excerpt": "Learn how Escrowly provides secure crypto transactions...",
      "readTime": 4,
      "isPublished": true,
      "publishedAt": "2024-12-27T00:00:00.000Z",
      "createdAt": "2024-12-27T00:00:00.000Z",
      "updatedAt": "2024-12-27T00:00:00.000Z"
    },
    {
      "id": "223e4567-e89b-12d3-a456-426614174001",
      "title": "The Future of Secure Crypto Transactions",
      "slug": "the-future-of-secure-crypto-transactions",
      "category": "BLOCKCHAIN_SECURITY",
      "imageUrl": "https://example.com/blog-image-2.jpg",
      "excerpt": "Exploring the future of cryptocurrency security...",
      "readTime": 5,
      "isPublished": true,
      "publishedAt": "2024-12-26T00:00:00.000Z",
      "createdAt": "2024-12-26T00:00:00.000Z",
      "updatedAt": "2024-12-26T00:00:00.000Z"
    }
  ],
  "total": 37,
  "page": 1,
  "limit": 10,
  "totalPages": 4
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:3002/api/v1/blogs?category=CRYPTO_ESCROW&published=true&page=1&limit=10"
```

---

### 3. Get Blog Categories

Get all blog categories with post count.

**Endpoint:** `GET /api/v1/blogs/categories`

**Response:** `200 OK`
```json
[
  {
    "category": "CRYPTO_ESCROW",
    "count": 15
  },
  {
    "category": "SECURITY",
    "count": 8
  },
  {
    "category": "REAL_ESTATE_ESCROW",
    "count": 5
  },
  {
    "category": "DOMAIN_NAME_ESCROW",
    "count": 3
  },
  {
    "category": "BLOCKCHAIN_SECURITY",
    "count": 4
  },
  {
    "category": "CRYPTO_TRANSACTIONS",
    "count": 2
  },
  {
    "category": "FINANCE_SECURITY",
    "count": 0
  }
]
```

**cURL Example:**
```bash
curl -X GET http://localhost:3002/api/v1/blogs/categories
```

**Use Case:** This endpoint is used to display category filters on the frontend blog page (e.g., "All Topics (37 posts)", "Crypto Escrow (15 posts)").

---

### 4. Get Blog by ID

Get a single blog post by its unique ID.

**Endpoint:** `GET /api/v1/blogs/:id`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Blog post ID |

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "CRYPTO_ESCROW",
  "imageUrl": "https://example.com/blog-image.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions...",
  "readTime": 4,
  "isPublished": true,
  "publishedAt": "2024-12-27T00:00:00.000Z",
  "createdAt": "2024-12-27T00:00:00.000Z",
  "updatedAt": "2024-12-27T00:00:00.000Z",
  "createdBy": "admin-user-id-123",
  "contentSections": [
    {
      "title": "How Escrowly Ensures Safe Transactions",
      "description": "Full content here...",
      "imageUrl": "https://example.com/section-1-image.jpg"
    }
  ]
}
```

**Error Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Blog with ID \"123e4567-e89b-12d3-a456-426614174000\" not found",
  "error": "Not Found"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:3002/api/v1/blogs/123e4567-e89b-12d3-a456-426614174000
```

---

### 5. Get Blog by Slug (Frontend Details Page)

Get a blog post by its slug. **This is the primary endpoint used when users click on a blog from the frontend.**

**Endpoint:** `GET /api/v1/blogs/slug/:slug`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | Yes | Blog post slug (URL-friendly identifier) |

**Example:**
```
GET /api/v1/blogs/slug/how-escrowly-ensures-safe-transactions
```

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "CRYPTO_ESCROW",
  "imageUrl": "https://example.com/blog-image.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions...",
  "readTime": 4,
  "isPublished": true,
  "publishedAt": "2024-12-27T00:00:00.000Z",
  "createdAt": "2024-12-27T00:00:00.000Z",
  "updatedAt": "2024-12-27T00:00:00.000Z",
  "contentSections": [
    {
      "title": "How Escrowly Ensures Safe Transactions",
      "description": "Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. By utilizing advanced technologies and best practices, Escrowly ensures that all parties involved in a transaction can have peace of mind.",
      "imageUrl": "https://example.com/section-1-image.jpg"
    },
    {
      "title": "Benefits of Using Escrowly",
      "description": "Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. Here's how Escrowly protects your interests:",
      "imageUrl": "https://example.com/section-2-image.jpg",
      "subsections": [
        {
          "title": "Fraud Prevention",
          "description": "Ensures that payments are only processed when conditions are met."
        },
        {
          "title": "Secure Crypto Transactions",
          "description": "Reduces the risks of scams in the volatile crypto market."
        },
        {
          "title": "Trust & Transparency",
          "description": "Builds confidence between buyers and sellers, fostering long-term business relationships."
        },
        {
          "title": "Global Reach",
          "description": "Allows businesses and freelancers to operate securely across international borders."
        },
        {
          "title": "Automated Process",
          "description": "Simplifies complex transactions with a user-friendly system."
        }
      ]
    },
    {
      "title": "Future-Proof Your Transactions with Escrowly",
      "description": "As digital transactions continue to evolve, businesses and individuals need a secure and reliable payment system that adapts to changing market conditions. Escrowly provides high-level security for cryptocurrency transactions and ensures your digital assets are protected."
    }
  ]
}
```

**Error Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Blog with slug \"invalid-slug\" not found",
  "error": "Not Found"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:3002/api/v1/blogs/slug/how-escrowly-ensures-safe-transactions
```

**Frontend Integration:**
```javascript
// When user clicks on a blog card
const blogSlug = 'how-escrowly-ensures-safe-transactions';
const response = await fetch(`/api/v1/blogs/slug/${blogSlug}`);
const blog = await response.json();

// Display blog details with:
// - blog.title
// - blog.imageUrl
// - blog.category
// - blog.contentSections (for table of contents and content)
```

---

### 6. Update Blog Post

Update an existing blog post (Admin only).

**Endpoint:** `PATCH /api/v1/blogs/:id`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Blog post ID |

**Request Body:** (All fields are optional - partial updates supported)
```json
{
  "title": "Updated Blog Title",
  "slug": "updated-blog-slug",
  "category": "SECURITY",
  "imageUrl": "https://example.com/new-image.jpg",
  "excerpt": "Updated excerpt...",
  "readTime": 5,
  "isPublished": true,
  "publishedAt": "2024-12-28T00:00:00.000Z",
  "contentSections": [
    {
      "title": "Updated Section Title",
      "description": "Updated content...",
      "imageUrl": "https://example.com/new-section-image.jpg"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Updated Blog Title",
  "slug": "updated-blog-slug",
  "category": "SECURITY",
  "imageUrl": "https://example.com/new-image.jpg",
  "excerpt": "Updated excerpt...",
  "readTime": 5,
  "isPublished": true,
  "publishedAt": "2024-12-28T00:00:00.000Z",
  "updatedAt": "2024-12-28T10:00:00.000Z",
  "contentSections": [...]
}
```

**Error Responses:**

`404 Not Found` - Blog doesn't exist
```json
{
  "statusCode": 404,
  "message": "Blog with ID \"123e4567-e89b-12d3-a456-426614174000\" not found",
  "error": "Not Found"
}
```

`400 Bad Request` - Slug already exists
```json
{
  "statusCode": 400,
  "message": "Blog with slug \"updated-blog-slug\" already exists",
  "error": "Bad Request"
}
```

**cURL Example:**
```bash
curl -X PATCH http://localhost:3002/api/v1/blogs/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Updated Blog Title",
    "isPublished": true
  }'
```

---

### 7. Delete Blog Post

Delete a blog post (Admin only).

**Endpoint:** `DELETE /api/v1/blogs/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Blog post ID |

**Response:** `204 No Content` (No response body)

**Error Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Blog with ID \"123e4567-e89b-12d3-a456-426614174000\" not found",
  "error": "Not Found"
}
```

**cURL Example:**
```bash
curl -X DELETE http://localhost:3002/api/v1/blogs/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Data Models

### BlogCategory Enum

```typescript
enum BlogCategory {
  CRYPTO_ESCROW           // Crypto escrow related posts
  SECURITY                 // Security and safety posts
  REAL_ESTATE_ESCROW      // Real estate escrow posts
  DOMAIN_NAME_ESCROW      // Domain name escrow posts
  BLOCKCHAIN_SECURITY     // Blockchain and security posts
  CRYPTO_TRANSACTIONS     // Crypto transaction posts
  FINANCE_SECURITY        // Finance and security posts
}
```

### BlogContentSection

```typescript
{
  title: string;                    // Section title
  description: string;              // Section content/description
  imageUrl?: string;                // Optional section image URL
  subsections?: BlogContentSection[]; // Optional nested subsections
}
```

### Blog Response Object

```typescript
{
  id: string;                       // UUID
  title: string;                    // Blog title
  slug: string;                     // URL-friendly identifier
  category: BlogCategory;           // Blog category
  imageUrl: string;                 // Featured image URL
  excerpt?: string;                 // Blog summary/excerpt
  readTime: number;                 // Estimated read time (minutes)
  isPublished: boolean;             // Publication status
  publishedAt?: Date;               // Publication date
  createdAt: Date;                  // Creation date
  updatedAt: Date;                  // Last update date
  createdBy?: string;                // Creator user ID
  contentSections: BlogContentSection[]; // Content sections
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message description",
  "error": "Error Type"
}
```

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (Delete success) |
| `400` | Bad Request (Validation error, duplicate slug, etc.) |
| `401` | Unauthorized (Missing or invalid token) |
| `403` | Forbidden (Insufficient permissions) |
| `404` | Not Found (Blog doesn't exist) |
| `500` | Internal Server Error |

### Example Error Responses

**400 Bad Request - Validation Error:**
```json
{
  "statusCode": 400,
  "message": [
    "title should not be empty",
    "slug must be a string",
    "category must be one of the following values: CRYPTO_ESCROW, SECURITY, ..."
  ],
  "error": "Bad Request"
}
```

**400 Bad Request - Duplicate Slug:**
```json
{
  "statusCode": 400,
  "message": "Blog with slug \"existing-slug\" already exists",
  "error": "Bad Request"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Blog with ID \"123e4567-e89b-12d3-a456-426614174000\" not found",
  "error": "Not Found"
}
```

---

## Examples

### Complete Workflow Example

#### 1. Create a Blog Post

```bash
POST /api/v1/blogs
Content-Type: application/json
Authorization: Bearer admin_token

{
  "title": "How Escrowly Ensures Safe Transactions",
  "slug": "how-escrowly-ensures-safe-transactions",
  "category": "CRYPTO_ESCROW",
  "imageUrl": "https://escrowly-bucket.s3.amazonaws.com/blogs/featured-123.jpg",
  "excerpt": "Learn how Escrowly provides secure crypto transactions...",
  "readTime": 4,
  "isPublished": true,
  "contentSections": [
    {
      "title": "How Escrowly Ensures Safe Transactions",
      "description": "Full content here...",
      "imageUrl": "https://escrowly-bucket.s3.amazonaws.com/blogs/section-1.jpg"
    }
  ]
}
```

#### 2. Get All Published Blogs

```bash
GET /api/v1/blogs?published=true&page=1&limit=10
```

#### 3. Get Blog Details (Frontend)

```bash
GET /api/v1/blogs/slug/how-escrowly-ensures-safe-transactions
```

#### 4. Update Blog

```bash
PATCH /api/v1/blogs/123e4567-e89b-12d3-a456-426614174000
Content-Type: application/json
Authorization: Bearer admin_token

{
  "isPublished": false
}
```

#### 5. Delete Blog

```bash
DELETE /api/v1/blogs/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer admin_token
```

---

## Frontend Integration Guide

### Blog List Page

```javascript
// Fetch all published blogs
const response = await fetch('/api/v1/blogs?published=true&page=1&limit=10');
const data = await response.json();

// Display blogs
data.blogs.forEach(blog => {
  console.log(blog.title);
  console.log(blog.imageUrl);
  console.log(blog.category);
  console.log(blog.createdAt);
});
```

### Blog Details Page

```javascript
// Get blog by slug (when user clicks on a blog)
const slug = 'how-escrowly-ensures-safe-transactions';
const response = await fetch(`/api/v1/blogs/slug/${slug}`);
const blog = await response.json();

// Display blog details
console.log(blog.title);
console.log(blog.imageUrl);
console.log(blog.category);

// Display content sections (table of contents)
blog.contentSections.forEach(section => {
  console.log(section.title);
  console.log(section.description);
  if (section.imageUrl) {
    console.log(section.imageUrl);
  }
  // Display subsections if any
  if (section.subsections) {
    section.subsections.forEach(subsection => {
      console.log(subsection.title);
      console.log(subsection.description);
    });
  }
});
```

### Category Filters

```javascript
// Get categories with count
const response = await fetch('/api/v1/blogs/categories');
const categories = await response.json();

// Display category filters
categories.forEach(cat => {
  console.log(`${cat.category}: ${cat.count} posts`);
});
```

---

## Testing with Swagger

The API is fully documented in Swagger UI. Access it at:

**Development:** http://localhost:3002/api/docs

Swagger provides:
- Interactive API testing
- Request/response schemas
- Authentication testing
- Try-it-out functionality

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

---

## Support

For issues or questions:
- Check the main README.md
- Review Swagger documentation at `/api/docs`
- Check application logs for detailed error messages

---

**Last Updated:** December 2024  
**API Version:** v1  
**Service:** Admin Service

