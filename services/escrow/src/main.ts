import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '@escrowly/auth-common';
import { AppModule } from './app.module';
import { setupSwagger } from './docs/swagger.setup';


async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application with debug logging enabled
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Get services for global guards
  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);

  // Enable CORS - Allow all origins for development/testing
  app.enableCors({
    origin: '*',
    credentials: false, // Must be false when origin is '*'
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

  // Apply global guards (order matters: JWT first, then Roles)
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, configService),
    new RolesGuard(reflector),
  );
  
  logger.log('✅ Global guards activated: JwtAuthGuard, RolesGuard');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Setup Swagger documentation
  setupSwagger(app);

  const port = process.env.PORT ?? 3004;
  await app.listen(port);

  logger.log(`🚀 Escrow service is running on: http://localhost:${port}/api`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
