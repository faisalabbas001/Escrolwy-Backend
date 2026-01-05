import "reflect-metadata";
import { NestFactory, Reflector } from "@nestjs/core";
import { ValidationPipe, Logger, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { JwtAuthGuard, RolesGuard } from "@escrowly/auth-common";
import { AppModule } from "./app.module";

/**
 * Bootstrap the Notification Service application
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

  // Get configuration service and reflector for guards
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const port = configService.get<number>("PORT", 3005);
  const serviceName = configService.get<string>(
    "SERVICE_NAME",
    "notification-service"
  );
  const nodeEnv = configService.get<string>("NODE_ENV", "development");

  // Apply global authentication and authorization guards
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
      .setTitle("Escrowly Notification Service")
      .setDescription(
        "Notification service for the Escrowly platform. " +
          "Handles email notifications via Resend, user preferences, and notification history."
      )
      .setVersion("1.0")
      .addTag("notifications", "Notification management endpoints")
      .addTag("health", "Health check endpoints")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
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

