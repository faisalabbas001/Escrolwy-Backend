import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Bootstrap the Wallet Service application
 *
 * Features:
 * - Swagger/OpenAPI documentation
 * - Global validation pipe
 * - API versioning
 * - Graceful shutdown
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Get configuration service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3004);
  const serviceName = configService.get<string>(
    'SERVICE_NAME',
    'wallet-service'
  );
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Enable CORS
  app.enableCors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
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
    })
  );

  // Swagger/OpenAPI Documentation
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Escrowly Wallet Service')
      .setDescription(
        'Blockchain execution engine for wallet management, deposits, and withdrawals. ' +
          'Handles custodial wallet creation, deposit processing, and on-chain transaction execution.'
      )
      .setVersion('1.0')
      .addTag('health', 'Health check endpoints')
      .addTag('payouts', 'Payout query endpoints')
      .addBearerAuth()
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

  // Start the application
  await app.listen(port);

  logger.log(`🚀 ${serviceName} is running on: http://localhost:${port}/api`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
}

bootstrap().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
