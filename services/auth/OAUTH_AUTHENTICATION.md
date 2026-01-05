# OAuth 2.0 Authentication

This document describes the OAuth 2.0 authentication flow implemented in the Escrowly Auth Service. The implementation supports Google, GitHub, and Apple (future) as identity providers.

## Table of Contents

- [Overview](#overview)
- [Supported Providers](#supported-providers)
- [Authentication Flow](#authentication-flow)
- [Endpoints](#endpoints)
  - [Start OAuth Flow](#1-start-oauth-flow)
  - [Handle OAuth Callback](#2-handle-oauth-callback)
- [Request/Response Examples](#requestresponse-examples)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Database Schema](#database-schema)
- [Security Considerations](#security-considerations)
- [Integration Guide](#integration-guide)

## Overview

The OAuth 2.0 implementation allows users to authenticate using their existing accounts from supported identity providers (Google, GitHub, Apple). This provides a seamless sign-in experience without requiring users to create new credentials.

**Key Features:**
- Support for multiple OAuth providers
- Automatic user creation for new OAuth users
- Linking OAuth accounts to existing email-based accounts
- Same response format as traditional login (`/auth/login`)
- CSRF protection via state parameter validation

## Supported Providers

| Provider | Status | Client ID Env Var | Client Secret Env Var |
|----------|--------|-------------------|----------------------|
| Google   | ✅ Active | `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` |
| GitHub   | ✅ Active | `GITHUB_CLIENT_ID` | `GITHUB_CLIENT_SECRET` |
| Apple    | 🔜 Future | `APPLE_CLIENT_ID` | `APPLE_CLIENT_SECRET` |

## Authentication Flow

```
┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Client  │      │ Auth Service │      │OAuth Provider│      │   Database   │
└────┬─────┘      └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
     │                    │                     │                     │
     │ 1. POST /start     │                     │                     │
     │    (redirect_uri,  │                     │                     │
     │     state)         │                     │                     │
     │───────────────────>│                     │                     │
     │                    │                     │                     │
     │ 2. authorization_url                     │                     │
     │<───────────────────│                     │                     │
     │                    │                     │                     │
     │ 3. Redirect to     │                     │                     │
     │    authorization_url                     │                     │
     │─────────────────────────────────────────>│                     │
     │                    │                     │                     │
     │ 4. User authenticates with provider      │                     │
     │                    │                     │                     │
     │ 5. Redirect with   │                     │                     │
     │    code & state    │                     │                     │
     │<─────────────────────────────────────────│                     │
     │                    │                     │                     │
     │ 6. POST /callback  │                     │                     │
     │    (code, state,   │                     │                     │
     │     redirect_uri)  │                     │                     │
     │───────────────────>│                     │                     │
     │                    │                     │                     │
     │                    │ 7. Exchange code    │                     │
     │                    │    for access_token │                     │
     │                    │────────────────────>│                     │
     │                    │                     │                     │
     │                    │ 8. access_token     │                     │
     │                    │<────────────────────│                     │
     │                    │                     │                     │
     │                    │ 9. Fetch user info  │                     │
     │                    │────────────────────>│                     │
     │                    │                     │                     │
     │                    │ 10. user info       │                     │
     │                    │<────────────────────│                     │
     │                    │                     │                     │
     │                    │ 11. Find/Create user│                     │
     │                    │─────────────────────────────────────────>│
     │                    │                     │                     │
     │                    │ 12. User data       │                     │
     │                    │<─────────────────────────────────────────│
     │                    │                     │                     │
     │ 13. user_id, role, │                     │                     │
     │     session tokens │                     │                     │
     │<───────────────────│                     │                     │
     │                    │                     │                     │
```

## Endpoints

### 1. Start OAuth Flow

Initiates the OAuth flow by generating an authorization URL for the specified provider.

**Endpoint:** `POST /api/v1/auth/oauth/:provider/start`

**Path Parameters:**
- `provider` - OAuth provider name: `google`, `github`, or `apple`

**Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "redirect_uri": "https://escrowly.com/auth/callback",
  "state": "random-state-string-12345"
}
```

**Request Fields:**
- `redirect_uri` (string, required): URI where provider will redirect after authentication. Must be registered with the OAuth provider.
- `state` (string, required): Random string for CSRF protection. Must be validated in callback.

**Response (200 OK):**
```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&scope=...&state=..."
}
```

**Response Fields:**
- `authorization_url` (string): Full URL to redirect the user to for authentication

---

### 2. Handle OAuth Callback

Handles the OAuth callback after user authorizes the application. Exchanges the authorization code for tokens, fetches user info, and creates a session.

**Endpoint:** `POST /api/v1/auth/oauth/:provider/callback`

**Path Parameters:**
- `provider` - OAuth provider name: `google`, `github`, or `apple`

**Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "code": "4/0AY0e-g7q...",
  "state": "random-state-string-12345",
  "redirect_uri": "https://escrowly.com/auth/callback"
}
```

**Request Fields:**
- `code` (string, required): Authorization code from OAuth provider
- `state` (string, required): State parameter (must match the one sent in /start)
- `redirect_uri` (string, required): Same redirect_uri used in /start

**Response (200 OK):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "requires_mfa": false,
  "session": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessExpiresIn": 900,
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshExpiresIn": 2592000
  }
}
```

**Response Fields:**
- `user_id` (string): UUID of the authenticated user
- `role` (string): User role (user, super-admin, staff-website, etc.)
- `requires_mfa` (boolean): Always `false` for OAuth login
- `session` (object): Session tokens (same format as `/auth/login`)
  - `accessToken` (string): JWT access token
  - `accessExpiresIn` (number): Access token expiry in seconds
  - `refreshToken` (string): JWT refresh token
  - `refreshExpiresIn` (number): Refresh token expiry in seconds

## Request/Response Examples

### Example 1: Start Google OAuth

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/oauth/google/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirect_uri": "https://escrowly.com/auth/callback",
    "state": "abc123xyz789"
  }'
```

**Response:**
```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=your-client-id&redirect_uri=https%3A%2F%2Fescrowly.com%2Fauth%2Fcallback&response_type=code&scope=openid+email+profile&state=abc123xyz789&access_type=offline&prompt=consent"
}
```

### Example 2: Start GitHub OAuth

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/oauth/github/start \
  -H "Content-Type: application/json" \
  -d '{
    "redirect_uri": "https://escrowly.com/auth/callback",
    "state": "github-state-456"
  }'
```

**Response:**
```json
{
  "authorization_url": "https://github.com/login/oauth/authorize?client_id=your-github-client-id&redirect_uri=https%3A%2F%2Fescrowly.com%2Fauth%2Fcallback&response_type=code&scope=read%3Auser+user%3Aemail&state=github-state-456"
}
```

### Example 3: Handle Google OAuth Callback

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/oauth/google/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AY0e-g7qXY...",
    "state": "abc123xyz789",
    "redirect_uri": "https://escrowly.com/auth/callback"
  }'
```

**Response:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "requires_mfa": false,
  "session": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzM1Njg5NjAwfQ...",
    "accessExpiresIn": 900,
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshExpiresIn": 2592000
  }
}
```

## Error Handling

### 400 Bad Request

**Invalid Provider:**
```json
{
  "statusCode": 400,
  "message": "Invalid OAuth provider: invalid. Supported providers: google, github, apple",
  "error": "Bad Request"
}
```

**Missing Required Fields:**
```json
{
  "statusCode": 400,
  "message": [
    "redirect_uri must be a string",
    "state must be a string"
  ],
  "error": "Bad Request"
}
```

**Provider Not Configured:**
```json
{
  "statusCode": 400,
  "message": "OAuth provider 'google' is not configured",
  "error": "Bad Request"
}
```

### 401 Unauthorized

**Invalid Authorization Code:**
```json
{
  "statusCode": 401,
  "message": "Failed to exchange authorization code",
  "error": "Unauthorized"
}
```

**Expired Authorization Code:**
```json
{
  "statusCode": 401,
  "message": "Invalid authorization code",
  "error": "Unauthorized"
}
```

### 500 Internal Server Error

**Token Exchange Failed:**
```json
{
  "statusCode": 500,
  "message": "OAuth token exchange failed"
}
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | For Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | For Google OAuth |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | For GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | For GitHub OAuth |
| `APPLE_CLIENT_ID` | Apple OAuth Client ID | For Apple OAuth |
| `APPLE_CLIENT_SECRET` | Apple OAuth Client Secret | For Apple OAuth |

### Example .env Configuration

```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.abcdefghijk12345
GITHUB_CLIENT_SECRET=abcdefghijklmnopqrstuvwxyz123456

# Apple OAuth (future)
# APPLE_CLIENT_ID=com.escrowly.auth
# APPLE_CLIENT_SECRET=...
```

### OAuth Provider Setup

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google+ API" and "Google Identity Service"
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen
6. Add authorized redirect URIs (e.g., `https://escrowly.com/auth/callback`)
7. Copy Client ID and Client Secret to `.env`

#### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in application details
4. Set "Authorization callback URL" (e.g., `https://escrowly.com/auth/callback`)
5. Copy Client ID and generate Client Secret
6. Add to `.env`

## Database Schema

OAuth credentials are stored in the `auth_credentials` table:

```prisma
model AuthCredential {
  id                      String    @id @default(uuid()) @db.Uuid
  userId                  String    @unique @map("user_id") @db.Uuid
  passwordHash            String?   @map("password_hash") @db.Text
  passwordAlgo            String?   @map("password_algo") @db.Text
  mfaEnabled              Boolean   @default(false) @map("mfa_enabled")
  mfaType                 String?   @map("mfa_type") @db.Text
  mfaSecretEncrypted      String?   @map("mfa_secret_encrypted") @db.Text
  oauthProvider           String?   @map("oauth_provider") @db.Text  // google, github, apple
  oauthSubject            String?   @map("oauth_subject") @db.Text   // Provider's unique user ID
  lastPasswordRotatedAt   DateTime? @map("last_password_rotated_at") @db.Timestamptz
  createdAt               DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt               DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id])
}
```

**Key Fields:**
- `oauthProvider`: The OAuth provider name (e.g., "google", "github")
- `oauthSubject`: The unique identifier for the user from the OAuth provider

## Security Considerations

### 1. State Parameter (CSRF Protection)

- **Always generate a unique, random state** for each OAuth flow
- Store the state temporarily (client-side or server-side)
- Validate the state returned in the callback matches the original
- Use cryptographically secure random generation

```javascript
// Example: Generate secure state
const state = crypto.randomBytes(32).toString('hex');
```

### 2. Redirect URI Validation

- Only allow pre-registered redirect URIs
- Configure allowed URIs in OAuth provider dashboard
- Never use dynamic redirect URIs from user input

### 3. Authorization Code Security

- Codes are single-use and short-lived (typically 10 minutes)
- Exchange codes immediately after receiving
- Never log or expose authorization codes

### 4. Token Storage

- Store access tokens securely on client
- Use HTTP-only cookies or secure storage
- Never expose tokens in URLs or logs

### 5. Account Linking

The system automatically handles:
- **New OAuth user**: Creates new user account
- **Existing email**: Links OAuth provider to existing account
- **Existing OAuth**: Returns existing user

## Integration Guide

### Frontend Integration (React/Next.js Example)

```typescript
// 1. Start OAuth Flow
const startOAuth = async (provider: 'google' | 'github') => {
  const state = generateRandomState(); // Store this for validation
  sessionStorage.setItem('oauth_state', state);
  
  const response = await fetch(`/api/v1/auth/oauth/${provider}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redirect_uri: 'https://escrowly.com/auth/callback',
      state,
    }),
  });
  
  const { authorization_url } = await response.json();
  window.location.href = authorization_url;
};

// 2. Handle Callback (on callback page)
const handleCallback = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const provider = 'google'; // Determine from URL or context
  
  // Validate state
  const originalState = sessionStorage.getItem('oauth_state');
  if (state !== originalState) {
    throw new Error('State mismatch - possible CSRF attack');
  }
  
  const response = await fetch(`/api/v1/auth/oauth/${provider}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      state,
      redirect_uri: 'https://escrowly.com/auth/callback',
    }),
  });
  
  const { user_id, role, session } = await response.json();
  
  // Store tokens and redirect
  localStorage.setItem('access_token', session.accessToken);
  localStorage.setItem('refresh_token', session.refreshToken);
  window.location.href = '/dashboard';
};
```

### Mobile App Integration

For mobile apps, use custom URL schemes or universal links:

```
redirect_uri: "escrowly://auth/callback"
```

Configure deep links in your mobile app to handle the callback.

## File Structure

```
src/auth/
├── dto/
│   └── oauth.dto.ts          # OAuth DTOs and types
├── oauth.service.ts          # OAuth business logic
├── auth.controller.ts        # OAuth endpoints (/oauth/:provider/*)
├── auth.module.ts            # Module registration
└── auth.service.ts           # Core auth service (session creation)
```

## Related Documentation

- [Swagger Documentation](http://localhost:3000/api/docs) - Interactive API documentation
- [Internal Service-to-Service APIs](./INTERNAL_SERVICE_TO_SERVICE.md) - S2S authentication
- [Guards and Access Control](./GUARDS_AND_ACCESS_CONTROL.md) - Security guards

## Troubleshooting

### Common Issues

1. **"OAuth provider 'X' is not configured"**
   - Ensure environment variables are set correctly
   - Restart the service after adding env vars

2. **"Failed to exchange authorization code"**
   - Code may have expired (try again)
   - Redirect URI mismatch (must match exactly)
   - Invalid client credentials

3. **"No verified email found"**
   - User's email on provider may not be verified
   - For GitHub: ensure `user:email` scope is included

4. **State Mismatch Errors**
   - Ensure state is stored and validated correctly
   - Check for URL encoding issues
