import "reflect-metadata";
import { NestFactory, Reflector } from "@nestjs/core";
import { ValidationPipe, Logger, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { JwtAuthGuard, RolesGuard } from "@escrowly/auth-common";
import { AppModule } from "./app.module";

/**
 * Bootstrap the Inquiry Service application
 *
 * Features:
 * - Swagger/OpenAPI documentation
 * - Global validation pipe
 * - CORS configuration
 * - API versioning
 * - Graceful shutdown
 */
async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });

  // Get configuration service, reflector for guards
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const port = configService.get<number>("PORT", 3003);
  const serviceName = configService.get<string>(
    "SERVICE_NAME",
    "inquiry-service"
  );
  const nodeEnv = configService.get<string>("NODE_ENV", "development");

  // Apply global authentication and authorization guards
  // COMMENTED OUT FOR TESTING - Uncomment to enable authentication
  app.useGlobalGuards(
    new JwtAuthGuard(reflector, configService),
    new RolesGuard(reflector)
  );

  // Enable CORS - Allow all origins for development/testing
  app.enableCors({
    origin: "*",
    credentials: false, // Must be false when origin is '*'
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
    ],
  });

  // Global API prefix
  app.setGlobalPrefix("api");

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Swagger/OpenAPI Documentation
  if (nodeEnv !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Escrowly Inquiry Service")
      .setDescription(
        "Inquiry and support ticket management service for the Escrowly platform. " +
          "Handles customer support inquiries, messages, attachments, and admin operations.\n\n" +
          "### Authentication\n\n" +
          "Most endpoints require JWT authentication. Include the access token in the Authorization header:\n\n" +
          "```\n" +
          "Authorization: Bearer <access_token>\n" +
          "```\n\n" +
          "### Roles\n\n" +
          "- **USER**: Regular users who can create and manage their own inquiries\n" +
          "- **SUPER_ADMIN**: Platform administrators with full access\n" +
          "- **STAFF_WEBSITE**: Staff members with limited admin access\n\n" +
          "### Public Endpoints\n\n" +
          "The following endpoints do not require authentication:\n" +
          "- `GET /api/v1/` - Service status\n" +
          "- `GET /api/v1/health` - Health check\n" +
          "- `GET /api/v1/health/ready` - Readiness check"
      )
      .setVersion("1.0")
      .addTag("inquiries", "Inquiry management endpoints")
      .addTag("health", "Health check endpoints (Public)")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token from Auth Service",
        },
        "access_token",
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Start server
  await app.listen(port, "0.0.0.0", () => {
    logger.log(`✅ ${serviceName} listening on port ${port}`);
    logger.log(
      `📚 Swagger docs available at http://localhost:${port}/api/docs`
    );
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.log("SIGTERM signal received: closing HTTP server");
    await app.close();
  });

  process.on("SIGINT", async () => {
    logger.log("SIGINT signal received: closing HTTP server");
    await app.close();
  });
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap application", err);
  process.exit(1);
});
