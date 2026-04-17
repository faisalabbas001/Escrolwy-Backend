import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard } from '@escrowly/auth-common';
import { AppModule } from './app.module';
import { setupSwagger } from './docs/swagger.setup';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Quick visibility into Kafka env
  logger.log(`[Startup] KAFKA_ENABLED=${process.env.KAFKA_ENABLED ?? 'undefined'}`);

  // Create NestJS application
  const app = await NestFactory.create(AppModule);

  // Get services for global guards
  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);

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
    // Global API prefix
    app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3005;
  await app.listen(port);

  logger.log(`Ledger service running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost/api/${port}/docs`);
}

bootstrap();

