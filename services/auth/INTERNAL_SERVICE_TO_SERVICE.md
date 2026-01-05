# Internal (Service-to-Service) APIs

This document describes the internal service-to-service authentication APIs provided by the Auth Service. These endpoints are designed for secure communication between microservices within the Escrowly platform.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Validate Token](#1-validate-token)
  - [Issue S2S Token](#2-issue-s2s-token)
- [Request/Response Examples](#requestresponse-examples)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Security Considerations](#security-considerations)

## Overview

The Internal Service-to-Service APIs enable secure token validation and issuance for inter-service communication. All endpoints are protected by service authentication and are not accessible to external clients.

**Base URL:** `/api/v1/internal/auth`

**Authentication:** All endpoints require the `x-service-token` header with a valid service-to-service token.

## Authentication

All internal endpoints are protected by the `ServiceAuthGuard`, which validates the `x-service-token` header against the `SERVICE_TO_SERVICE_TOKEN` environment variable.

### Required Header

```
x-service-token: <service-token-value>
```

### Configuration

Set the `SERVICE_TO_SERVICE_TOKEN` environment variable in your `.env` file:

```env
SERVICE_TO_SERVICE_TOKEN=your-secure-service-token-here
```

**⚠️ Security Note:** Use a strong, randomly generated token in production. This token should be shared securely between services.

## Endpoints

### 1. Validate Token

Validates an access or refresh token and returns user claims if the token is valid.

**Endpoint:** `POST /api/v1/internal/auth/validate`

**Headers:**
- `Content-Type: application/json`
- `x-service-token: <service-token>`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "scopes": ["read:profile", "write:data"],
  "exp": 1735689600
}
```

**Response (200 OK - Invalid Token):**
```json
{
  "valid": false
}
```

**Response Fields:**
- `valid` (boolean, required): Whether the token is valid
- `sub` (string, optional): User ID (subject) - only present if valid
- `role` (string, optional): User role - only present for access tokens
- `scopes` (array, optional): Token scopes/permissions - present for S2S tokens
- `exp` (number, optional): Token expiration timestamp (Unix epoch) - only present if valid

**Use Cases:**
- Verify user authentication before processing requests
- Extract user claims from tokens
- Validate tokens before making downstream service calls

---

### 2. Issue S2S Token

Issues a short-lived JWT token for service-to-service communication with specific scopes and audience.

**Endpoint:** `POST /api/v1/internal/auth/s2s/issue`

**Headers:**
- `Content-Type: application/json`
- `x-service-token: <service-token>`

**Request Body:**
```json
{
  "aud": "ledger",
  "scopes": ["read:balance", "write:transaction"],
  "ttl_sec": 600
}
```

**Request Fields:**
- `aud` (string, required): Target audience/service name (e.g., `ledger`, `wallet`, `escrow`, `notification`)
- `scopes` (array, required): Array of permission strings (e.g., `["read:balance", "write:transaction"]`)
- `ttl_sec` (number, optional): Time-to-live in seconds (default: 600, min: 60, max: 3600)

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 600
}
```

**Response Fields:**
- `token` (string, required): JWT token for service-to-service calls
- `expires_in` (number, required): Token lifetime in seconds

**Use Cases:**
- Generate tokens for calling other microservices
- Implement fine-grained access control with scopes
- Enable secure inter-service communication

## Request/Response Examples

### Example 1: Validate an Access Token

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/internal/auth/validate \
  -H "Content-Type: application/json" \
  -H "x-service-token: test-service-token-12345" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoidXNlciIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3MzU2ODk2MDAsImV4cCI6MTczNTY5MDUwMH0..."
  }'
```

**Response:**
```json
{
  "valid": true,
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "exp": 1735690500
}
```

### Example 2: Issue S2S Token for Ledger Service

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/internal/auth/s2s/issue \
  -H "Content-Type: application/json" \
  -H "x-service-token: test-service-token-12345" \
  -d '{
    "aud": "ledger",
    "scopes": ["read:balance", "write:transaction"],
    "ttl_sec": 600
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiczJzIiwic2NvcGVzIjpbInJlYWQ6YmFsYW5jZSIsIndyaXRlOnRyYW5zYWN0aW9uIl0sImlhdCI6MTc2NjA5OTA5MiwiZXhwIjoxNzY2MDk5NjkyLCJhdWQiOiJsZWRnZXIiLCJpc3MiOiJlc2Nyb3dseS1hdXRoIn0...",
  "expires_in": 600
}
```

### Example 3: Issue S2S Token with Default TTL

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/internal/auth/s2s/issue \
  -H "Content-Type: application/json" \
  -H "x-service-token: test-service-token-12345" \
  -d '{
    "aud": "wallet",
    "scopes": ["read:wallet"]
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 600
}
```

### Example 4: Validate an Invalid Token

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/internal/auth/validate \
  -H "Content-Type: application/json" \
  -H "x-service-token: test-service-token-12345" \
  -d '{
    "token": "invalid-token"
  }'
```

**Response:**
```json
{
  "valid": false
}
```

## Error Handling

### 401 Unauthorized

Returned when the `x-service-token` header is missing or invalid.

**Response:**
```json
{
  "statusCode": 401,
  "message": "Service authentication required",
  "error": "Unauthorized"
}
```

**Or:**
```json
{
  "statusCode": 401,
  "message": "Invalid service token",
  "error": "Unauthorized"
}
```

### 400 Bad Request

Returned when request validation fails (e.g., missing required fields, invalid types).

**Response:**
```json
{
  "statusCode": 400,
  "message": [
    "aud must be a string",
    "scopes must be an array",
    "ttl_sec must be an integer"
  ],
  "error": "Bad Request"
}
```

### 500 Internal Server Error

Returned when an unexpected server error occurs.

**Response:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SERVICE_TO_SERVICE_TOKEN` | Secret token for service-to-service authentication | Yes | - |
| `JWT_SECRET` | Secret key for JWT signing (used by internal service) | Yes | - |
| `PORT` | Port the auth service runs on | No | 3000 |

### Example .env Configuration

```env
# Service-to-Service Authentication
SERVICE_TO_SERVICE_TOKEN=your-secure-random-token-here

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-here
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# Service Configuration
PORT=3000
SERVICE_NAME=auth-service
```

## Security Considerations

### 1. Service Token Security

- **Never expose the service token** in client-facing code or public repositories
- Use environment variables or secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate service tokens regularly
- Use different tokens for different environments (dev, staging, production)

### 2. Token TTL Best Practices

- **Keep TTLs short** (default 600 seconds / 10 minutes) for S2S tokens
- Use longer TTLs only when necessary (max 3600 seconds / 1 hour)
- Implement token refresh mechanisms for long-running operations

### 3. Scope Management

- **Use least privilege principle**: Only request the scopes you need
- Implement scope validation in receiving services
- Document scope meanings and usage

### 4. Network Security

- These endpoints should **only be accessible** from within your service mesh/VPC
- Use network-level security (firewalls, VPC security groups) to restrict access
- Consider using mutual TLS (mTLS) for additional security

### 5. Monitoring and Logging

- Monitor failed authentication attempts
- Log token issuance and validation events
- Set up alerts for unusual patterns

### 6. Token Validation

- Always validate tokens in receiving services
- Check token expiration (`exp` claim)
- Verify audience (`aud` claim) matches the intended service
- Validate scopes before performing operations

## Implementation Details

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Service   │         │  Auth Service │         │   Service   │
│     A       │────────▶│  (Internal)   │────────▶│     B       │
└─────────────┘         └──────────────┘         └─────────────┘
     │                           │                        │
     │ 1. Request S2S Token      │                        │
     │    (with x-service-token) │                        │
     │                           │                        │
     │ 2. Receive JWT Token      │                        │
     │                           │                        │
     │                           │ 3. Validate Token      │
     │                           │    (with x-service-token)│
     │                           │                        │
     │                           │ 4. Return Claims       │
     │                           │                        │
     │ 5. Call Service B with    │                        │
     │    JWT Token              │                        │
     │───────────────────────────┼────────────────────────▶│
     │                           │                        │
     │                           │                        │ 6. Process Request
```

### Code Structure

```
src/
├── internal/
│   ├── internal.controller.ts    # API endpoints
│   ├── internal.service.ts       # Business logic
│   ├── internal.module.ts        # Module definition
│   └── dto/
│       └── internal.dto.ts       # Request/Response DTOs
├── guards/
│   └── service-auth.guard.ts     # Service token validation
└── auth/
    └── jwt.service.ts            # JWT generation/validation
```

### Service Flow

1. **Token Issuance (S2S Issue)**
   - Service A requests an S2S token with audience and scopes
   - Auth Service validates service token
   - Auth Service generates JWT with specified audience, scopes, and TTL
   - Token is returned to Service A

2. **Token Validation**
   - Service receives a JWT token from another service or user
   - Service calls validate endpoint with the token
   - Auth Service validates service token and JWT token
   - Claims are returned if valid

## Testing

### Manual Testing with cURL

See the [Request/Response Examples](#requestresponse-examples) section above for cURL commands.

### Integration Testing

When testing these endpoints, ensure:
1. `SERVICE_TO_SERVICE_TOKEN` is set in your test environment
2. Include the `x-service-token` header in all requests
3. Validate response structure matches expected DTOs

## API Versioning

These endpoints use API versioning (`/api/v1/`). Future breaking changes will be introduced in new versions while maintaining backward compatibility for existing versions.

## Related Documentation

- [Swagger Documentation](http://localhost:3000/api/docs) - Interactive API documentation
- [Guards and Access Control](./GUARDS_AND_ACCESS_CONTROL.md) - Information about guards
- [JWT Service](../src/auth/jwt.service.ts) - JWT implementation details

## Support

For issues or questions about the Internal Service-to-Service APIs:
1. Check the Swagger documentation at `/api/docs`
2. Review server logs for detailed error messages
3. Verify environment variables are correctly set
4. Ensure service token is valid and matches configuration
