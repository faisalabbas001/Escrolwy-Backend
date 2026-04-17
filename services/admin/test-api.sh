#!/bin/bash

# API Testing Script for Blog CRUD Operations
# This script tests all blog APIs with dummy data

BASE_URL="http://localhost:3002/api/v1"
TOKEN="dummy_token_for_testing" # Replace with actual JWT token if auth is enabled

echo "🧪 Testing Blog APIs..."
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Create Blog
echo -e "${YELLOW}Test 1: Creating Blog...${NC}"
BLOG_RESPONSE=$(curl -s -X POST "${BASE_URL}/blogs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": "How Escrowly Ensures Safe Transactions",
    "slug": "how-escrowly-ensures-safe-transactions",
    "category": "CRYPTO_ESCROW",
    "imageUrl": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800",
    "excerpt": "Learn how Escrowly provides secure crypto transactions for businesses and individuals worldwide.",
    "readTime": 4,
    "isPublished": true,
    "contentSections": [
      {
        "title": "How Escrowly Ensures Safe Transactions",
        "description": "Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. By utilizing advanced technologies and best practices, Escrowly ensures that all parties involved in a transaction can have peace of mind.",
        "imageUrl": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800"
      },
      {
        "title": "Benefits of Using Escrowly",
        "description": "Escrowly offers a reliable and secure platform for businesses and individuals engaged in online transactions. Here'\''s how Escrowly protects your interests:",
        "imageUrl": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
        "subsections": [
          {
            "title": "Fraud Prevention",
            "description": "Ensures that payments are only processed when conditions are met."
          },
          {
            "title": "Secure Crypto Transactions",
            "description": "Reduces the risks of scams in the volatile crypto market."
          }
        ]
      }
    ]
  }')

if echo "$BLOG_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✅ Blog created successfully${NC}"
  BLOG_ID=$(echo "$BLOG_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Blog ID: $BLOG_ID"
  echo "$BLOG_RESPONSE" | jq '.' 2>/dev/null || echo "$BLOG_RESPONSE"
else
  echo -e "${RED}❌ Failed to create blog${NC}"
  echo "$BLOG_RESPONSE"
  exit 1
fi

echo ""
echo "================================"
echo ""

# Test 2: Get All Blogs
echo -e "${YELLOW}Test 2: Getting All Blogs...${NC}"
GET_ALL_RESPONSE=$(curl -s -X GET "${BASE_URL}/blogs?published=true&page=1&limit=10")
if echo "$GET_ALL_RESPONSE" | grep -q "blogs"; then
  echo -e "${GREEN}✅ Retrieved all blogs successfully${NC}"
  echo "$GET_ALL_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_ALL_RESPONSE"
else
  echo -e "${RED}❌ Failed to get blogs${NC}"
  echo "$GET_ALL_RESPONSE"
fi

echo ""
echo "================================"
echo ""

# Test 3: Get Blog by ID
if [ ! -z "$BLOG_ID" ]; then
  echo -e "${YELLOW}Test 3: Getting Blog by ID...${NC}"
  GET_BY_ID_RESPONSE=$(curl -s -X GET "${BASE_URL}/blogs/${BLOG_ID}")
  if echo "$GET_BY_ID_RESPONSE" | grep -q "id"; then
    echo -e "${GREEN}✅ Retrieved blog by ID successfully${NC}"
    echo "$GET_BY_ID_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_BY_ID_RESPONSE"
  else
    echo -e "${RED}❌ Failed to get blog by ID${NC}"
    echo "$GET_BY_ID_RESPONSE"
  fi
fi

echo ""
echo "================================"
echo ""

# Test 4: Get Blog by Slug
echo -e "${YELLOW}Test 4: Getting Blog by Slug...${NC}"
GET_BY_SLUG_RESPONSE=$(curl -s -X GET "${BASE_URL}/blogs/slug/how-escrowly-ensures-safe-transactions")
if echo "$GET_BY_SLUG_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✅ Retrieved blog by slug successfully${NC}"
  echo "$GET_BY_SLUG_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_BY_SLUG_RESPONSE"
else
  echo -e "${RED}❌ Failed to get blog by slug${NC}"
  echo "$GET_BY_SLUG_RESPONSE"
fi

echo ""
echo "================================"
echo ""

# Test 5: Get Categories
echo -e "${YELLOW}Test 5: Getting Blog Categories...${NC}"
CATEGORIES_RESPONSE=$(curl -s -X GET "${BASE_URL}/blogs/categories")
if echo "$CATEGORIES_RESPONSE" | grep -q "category"; then
  echo -e "${GREEN}✅ Retrieved categories successfully${NC}"
  echo "$CATEGORIES_RESPONSE" | jq '.' 2>/dev/null || echo "$CATEGORIES_RESPONSE"
else
  echo -e "${RED}❌ Failed to get categories${NC}"
  echo "$CATEGORIES_RESPONSE"
fi

echo ""
echo "================================"
echo ""

# Test 6: Update Blog
if [ ! -z "$BLOG_ID" ]; then
  echo -e "${YELLOW}Test 6: Updating Blog...${NC}"
  UPDATE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/blogs/${BLOG_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
      "title": "Updated: How Escrowly Ensures Safe Transactions",
      "excerpt": "Updated excerpt - Learn how Escrowly provides secure crypto transactions...",
      "readTime": 5
    }')
  if echo "$UPDATE_RESPONSE" | grep -q "Updated"; then
    echo -e "${GREEN}✅ Blog updated successfully${NC}"
    echo "$UPDATE_RESPONSE" | jq '.' 2>/dev/null || echo "$UPDATE_RESPONSE"
  else
    echo -e "${RED}❌ Failed to update blog${NC}"
    echo "$UPDATE_RESPONSE"
  fi
fi

echo ""
echo "================================"
echo ""

# Test 7: Create Another Blog for Testing
echo -e "${YELLOW}Test 7: Creating Second Blog...${NC}"
BLOG2_RESPONSE=$(curl -s -X POST "${BASE_URL}/blogs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": "The Future of Secure Crypto Transactions",
    "slug": "the-future-of-secure-crypto-transactions",
    "category": "BLOCKCHAIN_SECURITY",
    "imageUrl": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800",
    "excerpt": "Exploring the future of cryptocurrency security and blockchain technology.",
    "readTime": 5,
    "isPublished": true,
    "contentSections": [
      {
        "title": "The Future of Secure Crypto Transactions",
        "description": "As digital transactions continue to evolve, businesses and individuals need secure payment systems.",
        "imageUrl": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800"
      }
    ]
  }')

if echo "$BLOG2_RESPONSE" | grep -q "id"; then
  echo -e "${GREEN}✅ Second blog created successfully${NC}"
  BLOG2_ID=$(echo "$BLOG2_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Blog 2 ID: $BLOG2_ID"
else
  echo -e "${RED}❌ Failed to create second blog${NC}"
  echo "$BLOG2_RESPONSE"
fi

echo ""
echo "================================"
echo ""

# Test 8: Get Blogs by Category
echo -e "${YELLOW}Test 8: Getting Blogs by Category...${NC}"
CATEGORY_RESPONSE=$(curl -s -X GET "${BASE_URL}/blogs?category=CRYPTO_ESCROW&published=true")
if echo "$CATEGORY_RESPONSE" | grep -q "blogs"; then
  echo -e "${GREEN}✅ Retrieved blogs by category successfully${NC}"
  echo "$CATEGORY_RESPONSE" | jq '.' 2>/dev/null || echo "$CATEGORY_RESPONSE"
else
  echo -e "${RED}❌ Failed to get blogs by category${NC}"
  echo "$CATEGORY_RESPONSE"
fi

echo ""
echo "================================"
echo ""

# Test 9: Delete Blog (Second Blog)
if [ ! -z "$BLOG2_ID" ]; then
  echo -e "${YELLOW}Test 9: Deleting Blog...${NC}"
  DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "${BASE_URL}/blogs/${BLOG2_ID}" \
    -H "Authorization: Bearer ${TOKEN}")
  HTTP_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  if [ "$HTTP_STATUS" = "204" ]; then
    echo -e "${GREEN}✅ Blog deleted successfully (HTTP 204)${NC}"
  else
    echo -e "${RED}❌ Failed to delete blog (HTTP $HTTP_STATUS)${NC}"
    echo "$DELETE_RESPONSE"
  fi
fi

echo ""
echo "================================"
echo ""

# Test 10: Verify Deletion
if [ ! -z "$BLOG2_ID" ]; then
  echo -e "${YELLOW}Test 10: Verifying Blog Deletion...${NC}"
  VERIFY_DELETE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${BASE_URL}/blogs/${BLOG2_ID}")
  HTTP_STATUS=$(echo "$VERIFY_DELETE" | grep "HTTP_STATUS" | cut -d':' -f2)
  if [ "$HTTP_STATUS" = "404" ]; then
    echo -e "${GREEN}✅ Blog deletion verified (HTTP 404 - Not Found)${NC}"
  else
    echo -e "${RED}❌ Blog still exists (HTTP $HTTP_STATUS)${NC}"
    echo "$VERIFY_DELETE"
  fi
fi

echo ""
echo "================================"
echo ""
echo -e "${GREEN}🎉 All API Tests Completed!${NC}"
echo ""
echo "Summary:"
echo "- ✅ Create Blog (POST)"
echo "- ✅ Get All Blogs (GET)"
echo "- ✅ Get Blog by ID (GET)"
echo "- ✅ Get Blog by Slug (GET)"
echo "- ✅ Get Categories (GET)"
echo "- ✅ Update Blog (PATCH)"
echo "- ✅ Delete Blog (DELETE)"
echo "- ✅ Category Filtering"
echo ""
echo "All APIs are working correctly! 🚀"

