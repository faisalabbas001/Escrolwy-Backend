# What is @escrowly/shared-config?

## Overview

`@escrowly/shared-config` is a **shared package** in the Escrowly monorepo that provides centralized secrets and configuration management for all microservices.

## Purpose

Instead of each service duplicating code for:
- Reading environment variables
- Fetching secrets from AWS Secrets Manager
- Managing database credentials
- Handling credential rotation

...all services use this **single shared package**.

## Key Features

### 1. **Environment-Agnostic Secrets**

Works seamlessly in:
- **Local Development**: Reads from `.env` files
- **Production/Stage**: Fetches from AWS Secrets Manager

No code changes needed between environments!

### 2. **Dynamic Database Credentials**

Automatically fetches database username/password from AWS Secrets Manager at runtime, replacing placeholders in `DATABASE_URL`:

```env
# .env file (has placeholders)
DATABASE_URL="postgresql://USERNAME:PASSWORD@host:5432/db?schema=listener_engine_db"
DB_SECRET_ARN="arn:aws:secretsmanager:..."
```

The service automatically:
1. Reads `DATABASE_URL` with placeholders
2. Fetches real credentials from Secrets Manager using `DB_SECRET_ARN`
3. Replaces `USERNAME` and `PASSWORD` with actual values
4. Returns complete connection string

### 3. **Credential Rotation Support**

AWS can automatically rotate database credentials. This package handles rotation transparently - your service code doesn't need to change.

## Usage in Listener Engine

```typescript
// app.module.ts
import { SecretsModule } from '@escrowly/shared-config';

@Module({
  imports: [
    SecretsModule,  // ← Makes SecretsService available globally
    // ...
  ],
})
export class AppModule {}
```

```typescript
// prisma.module.ts
import { SecretsService } from '@escrowly/shared-config';

@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (secretsService: SecretsService) => {
        // Get database URL with credentials from Secrets Manager
        const dbUrl = await secretsService.getDatabaseUrl();
        process.env.DATABASE_URL = dbUrl;
        return new PrismaService(secretsService);
      },
      inject: [SecretsService],
    },
  ],
})
export class PrismaModule {}
```

## Why Shared Package?

### ✅ Benefits

1. **DRY Principle**: Write secrets logic once, use everywhere
2. **Consistency**: All services handle secrets the same way
3. **Maintainability**: Fix bugs/add features in one place
4. **Security**: Centralized security best practices

### 📦 Monorepo Structure

```
escrowly-backend/
├── packages/
│   └── shared-config/          ← Shared package
│       ├── src/
│       │   ├── secrets.service.ts
│       │   └── secrets.module.ts
│       └── dist/                ← Built output
├── services/
│   ├── auth/
│   ├── listener-engine/        ← Uses shared-config
│   └── ...
```

## How It Works

1. **Package is built**: `npm run build -w @escrowly/shared-config`
2. **Services depend on it**: `"@escrowly/shared-config": "file:../../packages/shared-config"`
3. **TypeScript resolves**: Finds `dist/index.js` and `dist/index.d.ts`
4. **Runtime**: Service imports and uses `SecretsService`

## Common Issues

### ❌ "Cannot find module '@escrowly/shared-config'"

**Solution**: Build the shared package first:

```bash
npm run build -w @escrowly/shared-config
```

### ❌ "Module not found" after changes

**Solution**: Rebuild the shared package:

```bash
npm run build -w @escrowly/shared-config
```

---

**Note**: This is a **workspace package** (not published to npm). It's linked via `file:../../packages/shared-config` in each service's `package.json`.

