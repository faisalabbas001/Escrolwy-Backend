# @escrowly/shared-config

Shared configuration and secrets management package for all Escrowly microservices.

## 📋 Purpose

This package provides a **single source of truth** for secrets management across all services:

- Auth Service
- Wallet Service
- Ledger Service
- Escrow Service
- Inquiry Service
- Compliance Service
- Admin Service
- Reporting Service
- Notification Service

**No code duplication!** All services use the same `SecretsService`.

## 🎯 Strategy

- **Local Dev:** Reads from `.env` file (even when using AWS Aurora/KMS/S3)
- **Stage/Prod:** Fetches from AWS Secrets Manager

## 📦 Installation

In each service's `package.json`:

```json
{
  "dependencies": {
    "@escrowly/shared-config": "workspace:*"
  }
}
```

Then run:

```bash
npm install
```

## 💻 Usage

### Step 1: Import in Service Module

```typescript
import { SecretsModule } from "@escrowly/shared-config";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SecretsModule, // ← Import shared module
    // ... other modules
  ],
})
export class AppModule {}
```

### Step 2: Inject in Your Service

```typescript
import { SecretsService } from "@escrowly/shared-config";

@Injectable()
export class YourService {
  constructor(
    private readonly secrets: SecretsService, // ← Inject
  ) {}

  async doSomething() {
    const jwtSecret = this.secrets.getJwtSecret();
    const dbUrl = this.secrets.getDatabaseUrl();
    // ... use secrets
  }
}
```

## 🔧 Building

```bash
cd packages/shared-config
npm install
npm run build
```

## 📚 See Also

- `SECRETS_STRATEGY.md` in auth service for complete documentation
