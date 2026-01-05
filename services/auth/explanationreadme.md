# Escrowly Auth Service - API Documentation

This document provides comprehensive documentation for the Escrowly Authentication Service, including all API endpoints, database schema, request/response formats, and implementation details.

## Table of Contents
1. [Service Overview](#service-overview)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Authentication Flow](#authentication-flow)

---

## Service Overview

The Auth Service is responsible for:
- User registration and authentication
- Session management with JWT tokens
- Two-factor authentication (2FA)
- Password reset functionality
- User profile management

**Base URL**: `http://localhost:3000/api/v1/auth`

---

## Database Schema

### Users Table (`auth_db.users`)
Stores core user identity information.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key, unique user identifier |
| `email` | String | Unique email address (indexed) |
| `phone` | String (optional) | Phone number |
| `role` | String | User role: `user`, `super-admin`, `staff-website` |
| `created_at` | Timestamp | Account creation time |
| `updated_at` | Timestamp | Last update time |
| `deleted_at` | Timestamp (optional) | Soft delete timestamp |

### Auth Credentials Table (`auth_db.auth_credentials`)
Stores authentication credentials separately from user profile.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to users table (unique) |
| `password_hash` | String | Argon2id hashed password |
| `password_algo` | String | Hashing algorithm used (argon2id) |
| `mfa_enabled` | Boolean | Whether 2FA is enabled |
| `mfa_type` | String | Type of MFA (totp) |
| `mfa_secret_encrypted` | String | Encrypted TOTP secret |
| `oauth_provider` | String (optional) | OAuth provider name |
| `oauth_subject` | String (optional) | OAuth subject ID |
| `last_password_rotated_at` | Timestamp | Last password change |
| `created_at` | Timestamp | Record creation time |
| `updated_at` | Timestamp | Last update time |

### User Profiles Table (`auth_db.user_profiles`)
Stores user profile and business information.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to users table (unique) |
| `kyc_status` | String | KYC verification status: `not_started`, `pending`, `approved`, `rejected` |
| `kyc_level` | String (optional) | KYC verification level |
| `compliance_case_id` | String (optional) | Compliance case identifier |
| `display_name` | String (optional) | User's display name |
| `company_name` | String (optional) | Company name |
| `company_representative_name` | String (optional) | Company representative |
| `company_billing_address` | String (optional) | Billing address |
| `primary_phone` | String (optional) | Primary phone number |
| `preferred_language` | String | Language preference (default: 'en') |
| `created_at` | Timestamp | Record creation time |
| `updated_at` | Timestamp | Last update time |

### KYC Status Table (`auth_db.kyc_status`)
Tracks KYC verification status.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to users table (unique) |
| `status` | String | Current status: `not_started`, `pending`, `approved`, `rejected` |
| `level` | String (optional) | Verification level |
| `reference_id` | String (optional) | External reference ID |
| `updated_by_admin_id` | UUID (optional) | Admin who updated status |
| `reason` | String (optional) | Reason for status change |
| `created_at` | Timestamp | Record creation time |
| `updated_at` | Timestamp | Last update time |

### Password Reset Tokens Table (`auth_db.password_reset_tokens`)
Stores password reset tokens.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to auth_credentials |
| `token` | String | SHA-256 hashed reset token (unique, indexed) |
| `expires_at` | Timestamp | Token expiration time (indexed) |
| `used_at` | Timestamp (optional) | When token was used |
| `created_at` | Timestamp | Token creation time |

---

## API Endpoints

### 1. Authentication Endpoints

#### POST /auth/signup
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "role": "user",
  "displayName": "John Doe",
  "primaryPhone": "+1234567890",
  "companyName": "Acme Inc",
  "companyRepresentativeName": "Jane Smith",
  "companyBillingAddress": "123 Business St, City, Country",
  "preferredLanguage": "en",
  "acceptTerms": true
}
```

**Response (201 Created):**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "user",
  "kyc": {
    "state": "not_started",
    "updatedAt": "2025-12-16T12:00:00Z"
  },
  "session": {
    "accessToken": "eyJhbGc...",
    "accessExpiresIn": 900,
    "refreshToken": "eyJhbGc...",
    "refreshExpiresIn": 604800
  }
}
```

#### POST /auth/login
Authenticate with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "device": {
    "name": "Chrome on Windows",
    "ip": "192.168.1.1"
  },
  "mfaCode": "123456"
}
```

**Response (200 OK):**
```json
{
  "userId": "uuid",
  "role": "user",
  "requiresMfa": false,
  "session": {
    "accessToken": "eyJhbGc...",
    "accessExpiresIn": 900,
    "refreshToken": "eyJhbGc...",
    "refreshExpiresIn": 604800
  }
}
```

#### POST /auth/token/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc...",
  "device": {
    "name": "Chrome on Windows",
    "ip": "192.168.1.1"
  }
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGc...",
  "accessExpiresIn": 900,
  "refreshToken": "eyJhbGc...",
  "refreshExpiresIn": 604800
}
```

---

### 2. User & Role Management Endpoints

#### GET /auth/me
Get current authenticated user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "BUYER|SELLER|BROKER|ADMIN",
  "status": "ACTIVE|LOCKED|DISABLED",
  "kyc": {
    "state": "NOT_STARTED|PENDING|VERIFIED|REJECTED",
    "updated_at": "2025-12-16T12:00:00Z"
  },
  "profile": {
    "display_name": "John Doe",
    "primary_phone": "+1234567890",
    "company_name": "Acme Inc",
    "company_representative_name": "Jane Smith",
    "company_billing_address": "123 Business St, City, Country",
    "preferred_language": "en"
  }
}
```

#### PATCH /auth/profile
Update user profile information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body (all fields optional):**
```json
{
  "display_name": "John Doe Updated",
  "primary_phone": "+9876543210",
  "company_name": "New Company Inc",
  "company_representative_name": "Jane Doe",
  "company_billing_address": "456 New St, City, Country",
  "preferred_language": "es"
}
```

**Response (200 OK):**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "displayName": "John Doe Updated",
    "primaryPhone": "+9876543210",
    "companyName": "New Company Inc",
    "companyRepresentativeName": "Jane Doe",
    "companyBillingAddress": "456 New St, City, Country",
    "preferredLanguage": "es"
  }
}
```

---

### 3. Password Management Endpoints

#### POST /auth/password/forgot
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "Password forget link have been send in email check your email"
}
```

#### POST /auth/password/reset
Reset password using token from email.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass456!"
}
```

**Response (200 OK):**
```json
{
  "message": "Password has been reset successfully"
}
```

#### POST /auth/password/change
Change password for authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

---

### 4. Two-Factor Authentication Endpoints

#### POST /auth/2fa/setup
Generate QR code for 2FA setup.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (201 Created):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otpauthUrl": "otpauth://totp/Escrowly:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Escrowly",
  "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgo..."
}
```

#### POST /auth/2fa/verify
Verify and enable 2FA.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "enabled": true,
  "message": "Two-factor authentication enabled successfully"
}
```

#### POST /auth/2fa/disable
Disable 2FA.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "enabled": false,
  "message": "Two-factor authentication disabled successfully"
}
```

#### GET /auth/2fa/status
Get 2FA status.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "enabled": true,
  "type": "totp"
}
```

---

### 5. Session Management Endpoints

#### POST /auth/logout
Logout current session.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (204 No Content)**

#### POST /auth/logout-all
Logout all sessions for the user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (204 No Content)**

---

## Authentication Flow

### 1. User Registration
1. User submits signup form with email, password, and profile details
2. System validates input (email format, password strength, terms acceptance)
3. System checks if email already exists
4. Password is hashed using Argon2id
5. User record, auth credentials, user profile, and KYC status are created in a transaction
6. JWT access and refresh tokens are generated
7. Session is stored in Redis
8. Tokens are returned to client

### 2. User Login
1. User submits email and password
2. System validates credentials
3. If 2FA is enabled, system requests MFA code
4. System generates new session with JWT tokens
5. Tokens are returned to client

### 3. Token Refresh
1. Client sends refresh token
2. System validates refresh token
3. System checks for token reuse (security)
4. New access and refresh tokens are generated
5. Old refresh token is rotated in Redis
6. New tokens are returned to client

### 4. Password Reset
1. User requests password reset with email
2. System generates secure reset token (SHA-256 hashed)
3. Reset link is sent via email
4. User clicks link and submits new password
5. System validates token and updates password
6. All existing sessions are revoked for security
7. Confirmation email is sent

---

## Error Responses

All error responses follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

Common status codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (invalid credentials or token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (email already exists)
- `500` - Internal Server Error

---

## Security Features

1. **Password Hashing**: Argon2id with OWASP-recommended parameters
2. **JWT Tokens**: Short-lived access tokens (15min) and long-lived refresh tokens (7 days)
3. **Token Rotation**: Refresh tokens are rotated on each use
4. **Session Management**: Redis-backed sessions with device tracking
5. **2FA Support**: Time-based One-Time Password (TOTP)
6. **Password Reset**: Secure token-based flow with 1-hour expiration
7. **Soft Delete**: User accounts are soft-deleted, not permanently removed
8. **Rate Limiting**: (To be implemented)
9. **CORS**: Configured for cross-origin requests

---

## Environment Variables

See `.env.example` for required configuration:

- `PORT`: Service port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT signing (min 32 chars)
- `JWT_ACCESS_TOKEN_EXPIRY`: Access token expiration (default: 15m)
- `JWT_REFRESH_TOKEN_EXPIRY`: Refresh token expiration (default: 7d)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Email configuration
- `FRONTEND_URL`: Frontend URL for password reset links

---

## Testing

Use the provided test scripts:
- `./test-signup.sh` - Test user registration
- `./test-password-reset.sh` - Test password reset flow
- `./test-all-apis.sh` - Test all endpoints

Or use Swagger UI at: `http://localhost:3001/api/docs`

---

## 6. Admin-only Endpoints

These endpoints are called by the Admin Service with an admin access token. Requires `super-admin` or `staff-website` role.

**Base URL**: `http://localhost:3000/api/v1/admin`

#### GET /admin/users
List users with pagination and filters.

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Query Parameters:**
- `q` (optional): Search query (email, name)
- `role` (optional): Filter by role (`user`, `super-admin`, `staff-website`)
- `status` (optional): Filter by status (`ACTIVE`, `LOCKED`, `DISABLED`)
- `kyc_state` (optional): Filter by KYC state (`not_started`, `pending`, `approved`, `rejected`)
- `page` (optional): Page number (default: 1)
- `page_size` (optional): Page size (default: 50, max: 100)

**Response (200 OK):**
```json
{
  "items": [
    {
      "user_id": "uuid",
      "email": "string",
      "role": "user|super-admin|staff-website",
      "status": "ACTIVE|LOCKED|DISABLED",
      "kyc": {
        "state": "not_started|pending|approved|rejected",
        "updated_at": "datetime"
      },
      "created_at": "datetime",
      "last_login_at": "datetime|null"
    }
  ],
  "page": 1,
  "page_size": 50,
  "total": 123
}
```

#### PATCH /admin/users/:user_id/status
Update user status (lock/unlock/disable).

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "status": "ACTIVE|LOCKED|DISABLED",
  "reason": "string"
}
```

**Response (200 OK):**
```json
{
  "status": "ACTIVE"
}
```

**Events Emitted:**
- `user.locked` - When user is locked
- `user.unlocked` - When user is unlocked

#### PATCH /admin/users/:user_id/role
Update user role (super-admin only).

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "role": "user|super-admin|staff-website"
}
```

**Response (200 OK):**
```json
{
  "role": "user"
}
```

**Events Emitted:**
- `user.role_changed` - When role is updated

#### POST /admin/users/:user_id/impersonate
Generate impersonation token for admin to act as user.

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Response (200 OK):**
```json
{
  "impersonation_token": "jwt",
  "expires_in": 900
}
```

**Note:** Impersonation tokens expire in 15 minutes and are audit-logged.

#### POST /admin/users/:user_id/sessions/revoke
Revoke all active sessions for a user.

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Response (200 OK):**
```json
{
  "revoked": true
}
```

---

## 7. Internal (Service-to-Service) Endpoints

These endpoints are for internal service-to-service communication. Requires service authentication token.

**Base URL**: `http://localhost:3000/api/v1/internal/auth`

#### POST /internal/auth/validate
Validate JWT token and return user claims.

**Headers:**
```
X-Service-Token: <service_token>
```

**Request Body:**
```json
{
  "token": "jwt"
}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "sub": "uuid",
  "role": "user",
  "scopes": ["read:users", "write:ledger"],
  "exp": 1734567890
}
```

**Response (Invalid Token):**
```json
{
  "valid": false
}
```

#### POST /internal/auth/s2s/issue
Issue service-to-service JWT token with scopes.

**Headers:**
```
X-Service-Token: <service_token>
```

**Request Body:**
```json
{
  "aud": "ledger|wallet|escrow|notification",
  "scopes": ["read:users", "write:ledger"],
  "ttl_sec": 600
}
```

**Response (200 OK):**
```json
{
  "token": "jwt",
  "expires_in": 600
}
```

**Note:** Service tokens expire in 10 minutes by default (configurable 60-3600 seconds).

---

## Additional Environment Variables

For admin and internal endpoints:

- `SERVICE_TO_SERVICE_TOKEN`: Secret token for service-to-service authentication (required for internal endpoints)

---

## Role-Based Access Control (RBAC)

### Roles
- `user`: Regular user (default)
- `super-admin`: Full administrative access
- `staff-website`: Limited admin access (user management only)

### Endpoint Access
- **User endpoints** (`/auth/*`): All authenticated users
- **Admin endpoints** (`/admin/*`): `super-admin` or `staff-website` only
- **Internal endpoints** (`/internal/*`): Service-to-service authentication only

---

## Security Notes

1. **Admin Endpoints**: Protected by `RolesGuard` - validates JWT and checks user role
2. **Internal Endpoints**: Protected by `ServiceAuthGuard` - validates `X-Service-Token` header
3. **Impersonation**: Audit-logged with admin ID tracking
4. **Service Tokens**: Scoped with specific permissions and short TTL
5. **Event Emission**: Admin actions emit events for audit trails

---

## Testing Results

All admin API endpoints have been tested and verified:

✅ **GET /admin/users** - List users with pagination and filters  
✅ **PATCH /admin/users/:id/status** - Lock/unlock/disable users  
✅ **PATCH /admin/users/:id/role** - Change user roles  
✅ **POST /admin/users/:id/impersonate** - Generate impersonation tokens  
✅ **POST /admin/users/:id/sessions/revoke** - Revoke all user sessions  
✅ **RBAC Protection** - Regular users blocked from admin endpoints  

All endpoints are working correctly and ready for production use.
