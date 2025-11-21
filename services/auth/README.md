# Auth Service

Authentication and authorization microservice for the Escrowly platform.

## 📋 Overview

The Auth Service handles:

- User registration and login
- JWT token generation and validation
- Session management
- Password hashing and verification
- User profile management
- Multi-factor authentication (future)

## 🏗️ Architecture

- **Framework**: NestJS (TypeScript)
- **ORM**: Prisma
- **Database**: PostgreSQL (auth_db schema in shared Aurora instance)
- **Cache**: Redis (sessions, rate limiting)
- **Events**: Kafka (user events via outbox pattern)
- **Documentation**: Swagger/OpenAPI

## 📁 Project Structure

```
src/
├── health/           # Health check endpoints
│   ├── health.controller.ts
│   ├── health.service.ts
│   └── health.module.ts
├── prisma/           # Database client
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts     # Root module
└── main.ts           # Application entry point

test/
├── utils/            # Test utilities
│   └── prisma-mock.ts
├── setup.ts          # Jest setup
└── app.e2e-spec.ts   # E2E tests

prisma/
└── schema.prisma     # Database schema
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose (for local services)
- npm >= 10.0.0

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Local Infrastructure

From the root `escrowly-backend` directory:

```bash
npm run docker:up
```

This starts:

- PostgreSQL (port 5432)
- Redis (port 6379)
- Redpanda/Kafka (port 9092)
- Mailhog (ports 1025, 8025)
- PgAdmin (port 5050)

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The default values work for local development.

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Run Migrations (when ready)

```bash
npm run prisma:migrate:dev
```

### 6. Start the Service

Development mode with hot reload:

```bash
npm run start:dev
```

The service will be available at:

- API: http://localhost:3001/api
- Swagger Docs: http://localhost:3001/api/docs
- Health Check: http://localhost:3001/api/v1/health

## 🧪 Testing

### Run Unit Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Generate Coverage Report

```bash
npm run test:cov
```

## 📊 Database

### Schema Location

This service uses the `auth_db` schema in a shared PostgreSQL instance.

**Local**: `localhost:5432/escrowly?schema=auth_db`
**AWS**: Aurora PostgreSQL endpoint (after infra deployment)

### View Database

Use PgAdmin at http://localhost:5050

- Email: `admin@escrowly.local`
- Password: `admin`

Or use Prisma Studio:

```bash
npm run prisma:studio
```

### Create Migration

```bash
npm run prisma:migrate:dev --name migration_name
```

## 📝 API Documentation

When running in development, Swagger documentation is available at:

**http://localhost:3001/api/docs**

The documentation includes:

- All endpoints with request/response schemas
- Authentication requirements
- Try-it-out functionality

## 🔑 Environment Variables

| Variable          | Description                               | Default                            |
| ----------------- | ----------------------------------------- | ---------------------------------- |
| `NODE_ENV`        | Environment (development/test/production) | `development`                      |
| `PORT`            | Service port                              | `3001`                             |
| `DATABASE_URL`    | PostgreSQL connection string              | Local PostgreSQL                   |
| `JWT_SECRET`      | Secret for JWT signing                    | `dummy_jwt_secret...`              |
| `REDIS_URL`       | Redis connection string                   | `redis://localhost:6379`           |
| `KAFKA_BROKERS`   | Kafka broker list                         | `localhost:9092`                   |
| `AWS_KMS_KEY_ARN` | KMS key for encryption                    | Dummy (replace after infra deploy) |

## 🏭 Production Deployment

### Build

```bash
npm run build
```

### Run in Production

```bash
npm run start:prod
```

### Docker Build

```bash
docker build -t escrowly/auth-service:latest .
```

## 🔧 Development Guidelines

### Code Style

- ESLint and Prettier configured
- Run `npm run lint` to check
- Run `npm run format` to auto-fix

### Testing Approach (TDD)

1. Write test first
2. Run test (should fail)
3. Implement feature
4. Run test (should pass)
5. Refactor if needed

Example test structure:

```typescript
describe('FeatureName', () => {
  let service: YourService;

  beforeEach(async () => {
    // Setup test module
  });

  it('should do something', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Database Best Practices

- Always use transactions for multi-step operations
- Use Prisma's type-safe queries
- Implement soft deletes where appropriate
- Use outbox pattern for events

## 📦 Dependencies

### Runtime

- `@nestjs/common`, `@nestjs/core` - NestJS framework
- `@prisma/client` - Database ORM
- `@nestjs/jwt`, `passport` - Authentication
- `kafkajs` - Event streaming
- `ioredis` - Redis client
- `@aws-sdk/*` - AWS services integration

### Development

- `@nestjs/testing` - Testing utilities
- `jest`, `ts-jest` - Testing framework
- `jest-mock-extended` - Advanced mocking
- `supertest` - HTTP testing
- `prisma` - Schema management

## 🐛 Troubleshooting

### Database Connection Failed

Ensure Docker services are running:

```bash
docker ps
```

Restart if needed:

```bash
npm run docker:restart
```

### Port Already in Use

Change `PORT` in `.env` file or kill the process using the port.

### Prisma Client Not Generated

Run:

```bash
npm run prisma:generate
```

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Swagger/OpenAPI Spec](https://swagger.io/specification/)

## 🤝 Contributing

Follow TDD principles and ensure all tests pass before committing:

```bash
npm test
npm run test:e2e
npm run lint
```

---

**Service Status**: ✅ Ready for Development
**Last Updated**: November 19, 2025
