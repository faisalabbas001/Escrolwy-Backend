import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Ledger Service API')
  .setDescription(
    `## Ledger Service API

API for managing financial transfers and balances. The Ledger Service is the single financial authority that validates balance sufficiency and records all money movements via immutable double-entry accounting.

### Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### Roles

- **USER**: Regular users who can create transfers and view their balances
- **SUPER_ADMIN**: Platform administrators with full access

### Public Endpoints

The following endpoints do not require authentication:
- \`GET /v1/health\` - Health check
- \`GET /v1/health/ready\` - Readiness check
`,
  )
  .setVersion('1.0.0')
  .setContact('Escrowly Support', 'https://escrowly.com', '')
  .setLicense('MIT', 'https://opensource.org/licenses/MIT')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT access token from Auth Service',
    },
    'access_token',
  )
  .addTag('health', 'Health and readiness checks (Public)')
  .addTag('transfers', 'Transfer management (Authenticated)')
  .addTag('accounts', 'Account and balance queries (Authenticated)')
  .build();

