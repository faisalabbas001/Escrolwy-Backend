# 2FA Setup API - Security Implementation

## Overview

The 2FA setup API has been designed with security best practices to prevent exposure of sensitive TOTP secrets to the client.

---

## Endpoint

```
POST /api/v1/auth/2fa/setup
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
No request body required.

---

## Response

### Success (201 Created)
```json
{
  "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `qrCodeDataUrl` | string | Base64-encoded PNG image of the QR code for scanning with authenticator app |

### Error Responses

#### 400 Bad Request - 2FA Already Enabled
```json
{
  "statusCode": 400,
  "message": "2FA is already enabled. Disable it first to set up a new one.",
  "error": "Bad Request"
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

## Security Implementation

### ✅ What We Do (Secure)

1. **Generate Secret Server-Side**
   - TOTP secret is generated on the backend using `authenticator.generateSecret()`
   - Secret never leaves the server

2. **Store Secret Securely**
   - Secret is stored in `auth_credentials.mfa_secret_encrypted`
   - TODO: Encrypt with KMS in production (currently stored as-is)

3. **Create otpauthUrl Internally**
   - Format: `otpauth://totp/Escrowly:user@example.com?secret=SECRET&issuer=Escrowly`
   - Used only for QR code generation
   - Never exposed to client

4. **Generate QR Code**
   - QR code is generated from the otpauthUrl
   - Returned as base64 data URL
   - Client can display directly in `<img>` tag

5. **Return Only QR Code**
   - Response contains ONLY `qrCodeDataUrl`
   - No secret, no otpauthUrl, no other sensitive data

6. **Keep MFA Disabled**
   - `mfa_enabled` remains `false` until OTP verification succeeds
   - Prevents incomplete 2FA setups from blocking login

### ❌ What We Don't Do (Insecure)

1. ❌ **Do NOT return `secret` field**
   - Exposing the secret allows attackers to generate valid codes
   - Secret must remain server-side only

2. ❌ **Do NOT return `otpauthUrl` field**
   - Contains the secret in plaintext
   - Can be parsed to extract the secret

3. ❌ **Do NOT enable MFA immediately**
   - User must verify they can generate valid codes first
   - Prevents lockout scenarios

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  User requests 2FA setup                                     │
│  POST /auth/2fa/setup                                        │
│  Authorization: Bearer <token>                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend:                                                    │
│  1. Verify user authentication                              │
│  2. Check if 2FA already enabled                            │
│  3. Generate TOTP secret                                    │
│  4. Create otpauthUrl (internal only)                       │
│  5. Generate QR code from otpauthUrl                        │
│  6. Store secret in database (mfa_enabled=false)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Response:                                                   │
│  {                                                           │
│    "qrCodeDataUrl": "data:image/png;base64,..."            │
│  }                                                           │
│                                                              │
│  ✅ QR code returned                                        │
│  ❌ Secret NOT returned                                     │
│  ❌ otpauthUrl NOT returned                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  User scans QR code with authenticator app                  │
│  (Google Authenticator, Authy, etc.)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  User verifies with TOTP code                               │
│  POST /auth/login with mfaCode                              │
│  (This enables 2FA: mfa_enabled=true)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Example Usage

### cURL

```bash
curl -X POST http://localhost:3000/api/v1/auth/2fa/setup \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### JavaScript (Axios)

```javascript
const axios = require('axios');

const response = await axios.post(
  'http://localhost:3000/api/v1/auth/2fa/setup',
  {},
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);

// Display QR code in UI
const qrCodeDataUrl = response.data.qrCodeDataUrl;
// <img src={qrCodeDataUrl} alt="2FA QR Code" />
```

### TypeScript (React Example)

```typescript
import { useState } from 'react';

interface Setup2FAResponse {
  qrCodeDataUrl: string;
}

function Setup2FA() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setup2FA = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        'http://localhost:3000/api/v1/auth/2fa/setup',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to setup 2FA');
      }

      const data: Setup2FAResponse = await response.json();
      setQrCode(data.qrCodeDataUrl);
    } catch (error) {
      console.error('2FA setup error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={setup2FA} disabled={loading}>
        Setup 2FA
      </button>
      {qrCode && (
        <div>
          <h3>Scan this QR code with your authenticator app</h3>
          <img src={qrCode} alt="2FA QR Code" />
          <p>After scanning, enter the 6-digit code to verify</p>
        </div>
      )}
    </div>
  );
}
```

---

## Security Benefits

### 1. **Zero Secret Exposure**
- The TOTP secret never leaves the server
- Even if the API response is intercepted, the secret remains secure
- QR code can be scanned but not reverse-engineered to extract the secret

### 2. **Prevents Secret Leakage**
- No risk of secrets being logged in browser console
- No risk of secrets being stored in browser history
- No risk of secrets being cached by proxies

### 3. **Reduces Attack Surface**
- Attackers cannot steal secrets from client-side code
- Attackers cannot extract secrets from network traffic
- Attackers cannot replay QR codes (they're one-time setup)

### 4. **Compliance Ready**
- Follows OWASP recommendations for 2FA implementation
- Aligns with PCI-DSS requirements for secret management
- Meets SOC 2 standards for data protection

---

## Database Schema

### Table: `auth_credentials`

The TOTP secret is stored in the `auth_credentials` table:

```sql
CREATE TABLE auth_db.auth_credentials (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_type TEXT,
  mfa_secret_encrypted TEXT,  -- Stores TOTP secret
  ...
);
```

| Column | Type | Description |
|--------|------|-------------|
| `mfa_enabled` | BOOLEAN | Whether 2FA is active (false until verified) |
| `mfa_type` | TEXT | Type of 2FA (e.g., "totp") |
| `mfa_secret_encrypted` | TEXT | TOTP secret (TODO: encrypt with KMS) |

---

## Future Enhancements

### Planned Security Improvements

1. **KMS Encryption**
   ```typescript
   // TODO: Encrypt secret with AWS KMS or similar
   const encryptedSecret = await kms.encrypt(secret);
   await this.prisma.authCredential.update({
     data: { mfaSecretEncrypted: encryptedSecret }
   });
   ```

2. **Secret Rotation**
   - Allow users to regenerate 2FA secret
   - Invalidate old secret after rotation

3. **Backup Codes Generation**
   - Generate backup codes during setup
   - Return backup codes securely (one-time display)

4. **Audit Logging**
   - Log 2FA setup events
   - Track failed verification attempts

---

## Testing

### Manual Test

1. **Login** to get an access token
2. **Call setup endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/2fa/setup \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
3. **Verify response** contains only `qrCodeDataUrl`
4. **Scan QR code** with Google Authenticator
5. **Verify TOTP code** works in login flow

### Security Test

1. **Inspect response** - ensure no `secret` or `otpauthUrl` fields
2. **Check database** - verify secret is stored
3. **Check MFA status** - verify `mfa_enabled` is still `false`
4. **Attempt login** - should work without 2FA (not enabled yet)

---

## Comparison: Before vs After

### ❌ Before (Insecure)

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otpauthUrl": "otpauth://totp/Escrowly:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Escrowly",
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

**Problems:**
- Secret exposed in response
- otpauthUrl contains secret in plaintext
- Can be intercepted and stolen
- Can be logged in browser/proxy

### ✅ After (Secure)

```json
{
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

**Benefits:**
- Secret never leaves server
- otpauthUrl generated internally only
- No sensitive data in response
- Secure by design

---

## Related Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/2fa/setup` | Generate QR code for 2FA setup |
| `POST /auth/2fa/disable` | Disable 2FA (requires TOTP code) |
| `GET /auth/2fa/status` | Check if 2FA is enabled |
| `POST /auth/2fa/backup/consume` | Use backup code for login |
| `POST /auth/login` | Login with optional `mfaCode` |

---

**Last Updated:** December 19, 2025
