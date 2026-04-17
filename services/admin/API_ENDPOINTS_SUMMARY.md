# 🚀 Blog API Endpoints - Quick Reference

Quick reference guide for all Blog API endpoints.

## Base URL
```
http://localhost:3002/api/v1
```

---

## 📋 All Endpoints

### 1. **Create Blog** (Admin Only)
```
POST /api/v1/blogs
```
- **Auth:** Required (Bearer Token)
- **Body:** CreateBlogDto
- **Response:** 201 Created - BlogResponseDto

---

### 2. **Get All Blogs**
```
GET /api/v1/blogs
```
- **Auth:** Optional
- **Query Params:**
  - `category` (optional) - Filter by category
  - `published` (optional) - Filter by published status (true/false)
  - `page` (optional) - Page number (default: 1)
  - `limit` (optional) - Items per page (default: 10)
- **Response:** 200 OK - BlogListResponseDto

**Examples:**
- `GET /api/v1/blogs?published=true`
- `GET /api/v1/blogs?category=CRYPTO_ESCROW&published=true`
- `GET /api/v1/blogs?page=1&limit=10`

---

### 3. **Get Blog Categories**
```
GET /api/v1/blogs/categories
```
- **Auth:** Not Required
- **Response:** 200 OK - Array of {category, count}

---

### 4. **Get Blog by ID**
```
GET /api/v1/blogs/:id
```
- **Auth:** Not Required
- **Path Param:** `id` (UUID)
- **Response:** 200 OK - BlogResponseDto
- **Error:** 404 Not Found

---

### 5. **Get Blog by Slug** ⭐ (Frontend Details Page)
```
GET /api/v1/blogs/slug/:slug
```
- **Auth:** Not Required
- **Path Param:** `slug` (string)
- **Response:** 200 OK - BlogResponseDto (with full content sections)
- **Error:** 404 Not Found

**Example:**
- `GET /api/v1/blogs/slug/how-escrowly-ensures-safe-transactions`

---

### 6. **Update Blog** (Admin Only)
```
PATCH /api/v1/blogs/:id
```
- **Auth:** Required (Bearer Token)
- **Path Param:** `id` (UUID)
- **Body:** UpdateBlogDto (all fields optional)
- **Response:** 200 OK - BlogResponseDto
- **Errors:** 404 Not Found, 400 Bad Request

---

### 7. **Delete Blog** (Admin Only)
```
DELETE /api/v1/blogs/:id
```
- **Auth:** Required (Bearer Token)
- **Path Param:** `id` (UUID)
- **Response:** 204 No Content
- **Error:** 404 Not Found

---

## 📊 Blog Categories

Available categories:
- `CRYPTO_ESCROW`
- `SECURITY`
- `REAL_ESTATE_ESCROW`
- `DOMAIN_NAME_ESCROW`
- `BLOCKCHAIN_SECURITY`
- `CRYPTO_TRANSACTIONS`
- `FINANCE_SECURITY`

---

## 🔑 Authentication

**Header Format:**
```
Authorization: Bearer <your-jwt-token>
```

**Endpoints Requiring Auth:**
- ✅ POST /api/v1/blogs
- ✅ PATCH /api/v1/blogs/:id
- ✅ DELETE /api/v1/blogs/:id

**Public Endpoints:**
- ✅ GET /api/v1/blogs
- ✅ GET /api/v1/blogs/categories
- ✅ GET /api/v1/blogs/:id
- ✅ GET /api/v1/blogs/slug/:slug

---

## 📝 Request/Response Examples

### Create Blog Request
```json
{
  "title": "Blog Title",
  "slug": "blog-slug",
  "category": "CRYPTO_ESCROW",
  "imageUrl": "https://example.com/image.jpg",
  "excerpt": "Blog excerpt...",
  "readTime": 4,
  "isPublished": true,
  "contentSections": [
    {
      "title": "Section Title",
      "description": "Section content...",
      "imageUrl": "https://example.com/section-image.jpg"
    }
  ]
}
```

### Blog Response
```json
{
  "id": "uuid",
  "title": "Blog Title",
  "slug": "blog-slug",
  "category": "CRYPTO_ESCROW",
  "imageUrl": "https://example.com/image.jpg",
  "excerpt": "Blog excerpt...",
  "readTime": 4,
  "isPublished": true,
  "publishedAt": "2024-12-27T00:00:00.000Z",
  "createdAt": "2024-12-27T00:00:00.000Z",
  "updatedAt": "2024-12-27T00:00:00.000Z",
  "contentSections": [...]
}
```

---

## 🧪 Testing

### Using cURL

**Create Blog:**
```bash
curl -X POST http://localhost:3002/api/v1/blogs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "...", "slug": "...", ...}'
```

**Get All Blogs:**
```bash
curl http://localhost:3002/api/v1/blogs?published=true
```

**Get Blog by Slug:**
```bash
curl http://localhost:3002/api/v1/blogs/slug/how-escrowly-ensures-safe-transactions
```

**Update Blog:**
```bash
curl -X PATCH http://localhost:3002/api/v1/blogs/UUID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "Updated Title"}'
```

**Delete Blog:**
```bash
curl -X DELETE http://localhost:3002/api/v1/blogs/UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📚 Full Documentation

For complete API documentation with detailed examples, see:
- **BLOG_API_DOCUMENTATION.md** - Comprehensive API documentation
- **README.md** - Service overview and setup guide
- **Swagger UI** - http://localhost:3002/api/docs

---

**Quick Links:**
- 📖 [Full API Documentation](./BLOG_API_DOCUMENTATION.md)
- 🏠 [Main README](./README.md)
- 🔧 [Swagger Docs](http://localhost:3002/api/docs)

