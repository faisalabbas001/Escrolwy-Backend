import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Escrow Service API')
  .setDescription(
    `## Escrow Service API

API for managing escrow transactions and payments between buyers and sellers.

### Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### Roles

- **USER**: Regular users who can create and manage their own escrows
- **SUPER_ADMIN**: Platform administrators with full access
- **STAFF_WEBSITE**: Staff members with limited admin access

### Public Endpoints

The following endpoints do not require authentication:
- \`GET /v1/\` - Service status
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
  .addTag('app', 'Service status (Public)')
  .addTag('health', 'Health and readiness checks (Public)')
  .addTag('escrows', 'Escrow management (Authenticated)')
  .build();
