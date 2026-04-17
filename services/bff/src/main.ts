import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Bootstrap the BFF Service application
 * 
 * BFF (Backend for Frontend) acts as an API gateway:
 * - Validates JWT tokens (issued by Auth service)
 * - Routes requests to appropriate backend services
 * - Aggregates responses when needed
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const serviceName = configService.get<string>('SERVICE_NAME', 'bff-service');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');

  // Enable CORS - Allow all origins for development/testing
  app.enableCors({
    origin: '*',
    credentials: false, // Must be false when origin is '*'
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger/OpenAPI Documentation
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Escrowly BFF Service')
      .setDescription(
        'Backend for Frontend service. Routes requests to Auth, Admin, Inquiry, Escrow, Ledger, and Notification services. ' +
        'Handles JWT validation and request aggregation. ' +
        'Note: WebSocket connections connect directly from frontend to backend services (BFF does not proxy WebSockets).',
      )
      .setVersion('1.0')
      .addTag('auth', 'Authentication endpoints (proxy to Auth service)')
      .addTag('blogs', 'Blog management (proxy to Admin service)')
      .addTag('help-desk', 'Help desk / FAQ (proxy to Admin service)')
      .addTag('upload', 'File upload (proxy to Admin service)')
      .addTag('inquiries', 'Inquiry and support ticket management (proxy to Inquiry service)')
      .addTag('admin/inquiries', 'Admin inquiry management (proxy to Inquiry service)')
      .addTag('escrows', 'Escrow management (proxy to Escrow service)')
      .addTag('admin/escrows', 'Admin escrow management (proxy to Escrow service)')
      .addTag('ledger', 'Ledger and account management (proxy to Ledger service)')
      .addTag('notifications', 'Notification settings and history (proxy to Notification service)')
      .addTag('admin/notifications', 'Admin notification management (proxy to Notification service)')
      .addTag('admin/templates', 'Email template management (proxy to Notification service)')
      .addTag('health', 'Health check endpoints')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT access token',
        },
        'JWT-auth',
      )
      .build();
      
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }

  // Graceful shutdown handlers
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`🚀 ${serviceName} is running on: http://localhost:${port}/api`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`🔗 Auth Service: ${configService.get('AUTH_SERVICE_URL')}`);
  logger.log(`🔗 Admin Service: ${configService.get('ADMIN_SERVICE_URL')}`);
  logger.log(`🔗 Inquiry Service: ${configService.get('INQUIRY_SERVICE_URL')}`);
  logger.log(`🔗 Escrow Service: ${configService.get('ESCROW_SERVICE_URL')}`);
  logger.log(`🔗 Ledger Service: ${configService.get('LEDGER_SERVICE_URL')}`);
  logger.log(`🔗 Notification Service: ${configService.get('NOTIFICATION_SERVICE_URL')}`);
}

bootstrap().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});

