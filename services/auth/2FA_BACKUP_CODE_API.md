# 2FA Backup Code Consume API

## Overview

This API allows users to authenticate using a backup code when they cannot access their authenticator app (TOTP). Each backup code is single-use and securely hashed in the database.

---

## Endpoint

```
POST /api/v1/auth/2fa/backup/consume
```

**Authentication:** Required (Bearer Token)

---

## Request

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Body
```json
{
  "code": "string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | 8-character backup code (case-insensitive) |

---

## Response

### Success (200 OK)
```json
{
  "ok": true
}
```

### Error Responses

#### 400 Bad Request - 2FA Not Enabled
```json
{
  "statusCode": 400,
  "message": "2FA is not enabled for this account",
  "error": "Bad Request"
}
```

#### 400 Bad Request - No Backup Codes Available
```json
{
  "statusCode": 400,
  "message": "No unused backup codes available",
  "error": "Bad Request"
}
```

#### 401 Unauthorized - Invalid Code
```json
{
  "statusCode": 401,
  "message": "Invalid backup code",
  "error": "Unauthorized"
}
```

#### 401 Unauthorized - Not Authenticated
```json
{
  "statusCode": 401,
  "message": "Invalid token",
  "error": "Unauthorized"
}
```

---

## Behavior

### Flow

1. **User Authentication**: User must be authenticated (valid JWT token)
2. **2FA Check**: Verify that 2FA is enabled for the user
3. **Code Validation**: 
   - Normalize the code (uppercase, remove spaces/dashes)
   - Retrieve all unused backup codes for the user
   - Hash-compare the provided code against stored hashes
4. **Code Consumption**: 
   - If match found, mark the backup code as used (`used_at` timestamp)
   - Return success response
5. **Single-Use**: Once used, the backup code cannot be used again

### Security Features

- ✅ **Hashed Storage**: Backup codes are stored as Argon2id hashes
- ✅ **Single-Use**: Each code can only be used once
- ✅ **Authentication Required**: User must be logged in
- ✅ **2FA Verification**: Only works if 2FA is enabled
- ✅ **Constant-Time Comparison**: Uses Argon2 verify for timing-attack resistance

---

## Database Schema

### Table: `two_factor_backup_codes`

```sql
CREATE TABLE "auth_db"."two_factor_backup_codes" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("user_id") 
        REFERENCES "auth_db"."auth_credentials"("user_id")
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Reference to auth_credentials |
| `code_hash` | TEXT | Argon2id hash of the backup code |
| `used_at` | TIMESTAMPTZ | Timestamp when code was consumed (NULL if unused) |
| `created_at` | TIMESTAMPTZ | When the code was generated |

---

## Example Usage

### cURL

```bash
curl -X POST http://localhost:3000/api/v1/auth/2fa/backup/consume \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "code": "A1B2C3D4"
  }'
```

### JavaScript (Axios)

```javascript
const axios = require('axios');

const response = await axios.post(
  'http://localhost:3000/api/v1/auth/2fa/backup/consume',
  { code: 'A1B2C3D4' },
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);

console.log(response.data); // { ok: true }
```

### TypeScript

```typescript
interface BackupCodeConsumeRequest {
  code: string;
}

interface BackupCodeConsumeResponse {
  ok: boolean;
}

async function consumeBackupCode(
  accessToken: string, 
  code: string
): Promise<BackupCodeConsumeResponse> {
  const response = await fetch(
    'http://localhost:3000/api/v1/auth/2fa/backup/consume',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to consume backup code');
  }

  return response.json();
}
```

---

## Testing

### Manual Test

1. **Enable 2FA** for a user account
2. **Generate backup codes** (you'll need to implement a generation endpoint or manually insert)
3. **Login** to get an access token
4. **Call the API** with a valid backup code
5. **Verify** the response is `{ "ok": true }`
6. **Check database** that `used_at` is now set
7. **Try again** with the same code - should fail

### SQL Queries for Testing

#### Insert a test backup code:
```sql
-- Generate a hash for code "A1B2C3D4"
-- (Use argon2 in your app to generate the hash)

INSERT INTO auth_db.two_factor_backup_codes (user_id, code_hash)
VALUES (
  'your-user-id-here',
  '$argon2id$v=19$m=65536,t=3,p=4$...'  -- Hash of "A1B2C3D4"
);
```

#### Check unused codes:
```sql
SELECT id, user_id, used_at, created_at
FROM auth_db.two_factor_backup_codes
WHERE user_id = 'your-user-id'
  AND used_at IS NULL;
```

#### Check used codes:
```sql
SELECT id, user_id, used_at, created_at
FROM auth_db.two_factor_backup_codes
WHERE user_id = 'your-user-id'
  AND used_at IS NOT NULL
ORDER BY used_at DESC;
```

---

## Integration with Login Flow

This API can be integrated into the login flow as an alternative to TOTP:

```
┌─────────────────────────────────────────────────────────────┐
│  User enters email + password                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Server checks credentials                                   │
│  If 2FA enabled → return requiresMfa: true                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  User chooses:                                              │
│  - Enter TOTP code (from authenticator app)                 │
│  - Use backup code (if can't access app)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  POST /auth/login        │  │  POST /auth/2fa/backup/  │
│  with mfaCode            │  │  consume                 │
└──────────────────────────┘  └──────────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Session created, return tokens                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practices

### For Frontend Implementation

1. **Show backup code option** only after TOTP fails or on "Can't access app?" link
2. **Format input** to accept codes with/without spaces or dashes (e.g., "A1B2-C3D4")
3. **Show remaining codes** count after successful use
4. **Warn user** when running low on backup codes
5. **Provide regeneration** option when all codes are used

### For Backend Implementation

✅ **Already Implemented:**
- Secure hashing (Argon2id)
- Single-use enforcement
- Authentication requirement
- Input normalization
- Constant-time comparison

### Security Recommendations

1. **Generate 8-10 backup codes** during 2FA setup
2. **Use strong randomness** for code generation
3. **Display codes only once** during generation
4. **Encourage users to store** codes securely
5. **Log backup code usage** for security auditing
6. **Rate limit** the consume endpoint
7. **Alert user** when backup code is used

---

## Future Enhancements

- [ ] Add backup code generation endpoint
- [ ] Add endpoint to view remaining backup codes count
- [ ] Add endpoint to regenerate all backup codes
- [ ] Add email notification when backup code is used
- [ ] Add rate limiting (e.g., max 3 attempts per minute)
- [ ] Add audit logging for security events

---

**Last Updated:** December 19, 2025
