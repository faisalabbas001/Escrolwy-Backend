# @escrowly/shared-config

Shared configuration and secrets management package for all Escrowly microservices.

## Features

- **Environment-agnostic**: Works with `.env` (local dev) or AWS Secrets Manager (stage/prod)
- **Dynamic database credentials**: Fetches credentials from Secrets Manager at runtime
- **No code changes**: Same code works in all environments
- **Automatic credential rotation**: Handles AWS credential rotation automatically

## Usage

### Basic Setup

```typescript
import { SecretsModule } from "@escrowly/shared-config";

@Module({
  imports: [SecretsModule],
})
export class AppModule {}
```

### Getting Secrets

```typescript
import { SecretsService } from "@escrowly/shared-config";

@Injectable()
export class MyService {
  constructor(private readonly secrets: SecretsService) {}

  async someMethod() {
    // Get any secret
    const jwtSecret = this.secrets.getSecret("JWT_SECRET");

    // Get database URL (with credentials from Secrets Manager)
    const dbUrl = await this.secrets.getDatabaseUrl();
  }
}
```

## Database Connection Strings

### Configuration

In your service's `.env` file:

```env
# Database URL with placeholders
DATABASE_URL="postgresql://USERNAME:PASSWORD@host:5432/db?schema=service_db"

# Database Secret ARN (from CDK outputs)
DB_SECRET_ARN="arn:aws:secretsmanager:region:account:secret:name-xxxxx"
```

### How It Works

1. **Service starts** → Reads `DATABASE_URL` from `.env` (with `USERNAME:PASSWORD` placeholders)
2. **SecretsService.getDatabaseUrl()** → Fetches actual credentials from Secrets Manager using `DB_SECRET_ARN`
3. **Replaces placeholders** → `USERNAME` and `PASSWORD` are replaced with real values
4. **Returns final URL** → Complete connection string ready to use

### Why This Approach?

- ✅ **Credential Rotation**: AWS automatically rotates database credentials. Hardcoding them would break after rotation.
- ✅ **Security**: Credentials never stored in code or `.env` files
- ✅ **Flexibility**: Same code works in local dev (with static credentials) and AWS (with Secrets Manager)

## Environment Variables

### Required

- `DATABASE_URL` - Connection string template with `USERNAME:PASSWORD` placeholders
- `DB_SECRET_ARN` - ARN of the secret containing database credentials (from CDK outputs)

### Optional

- `AWS_SECRETS_MANAGER_ARN` - For application secrets (JWT, API keys, etc.)
- `AWS_REGION` - AWS region (default: `us-east-1`)

## Local Development

For local development, you can use static credentials:

```env
# Local dev - static credentials (no Secrets Manager needed)
DATABASE_URL="postgresql://username:password@localhost:5432/escrowly?schema=auth_db"
# DB_SECRET_ARN not needed for local dev
```

The service will detect if placeholders are present and only fetch from Secrets Manager if needed.

## Production/Stage

In production/stage environments:

```env
# Production - dynamic credentials from Secrets Manager
DATABASE_URL="postgresql://USERNAME:PASSWORD@aurora-endpoint:5432/escrowly?schema=auth_db"
DB_SECRET_ARN="arn:aws:secretsmanager:us-east-1:123456789012:secret:aurora-secret-xxxxx"
```

Credentials are fetched automatically from Secrets Manager on service startup.
