import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SecretsModule, SecretsService } from "@escrowly/shared-config";
import { PrismaService } from "./prisma.service";

/**
 * Prisma Module
 *
 * Provides database connection and Prisma Client globally.
 * - Connects to notification_db schema
 * - Manages connection lifecycle
 * - Available throughout the application
 */
@Module({})
export class PrismaModule {
  static forRoot(): DynamicModule {
    return {
      module: PrismaModule,
      imports: [ConfigModule, SecretsModule],
      providers: [
        PrismaService,
        {
          provide: "DATABASE_URL_PROVIDER",
          useFactory: async (
            configService: ConfigService,
            secretsService: SecretsService
          ) => {
            // If DATABASE_URL is already provided (e.g. local .env), use it and skip secrets lookup
            const existingDatabaseUrl = configService.get<string>("DATABASE_URL");
            if (existingDatabaseUrl) {
              process.env.DATABASE_URL = existingDatabaseUrl;
              return existingDatabaseUrl;
            }
            // Get database credentials from environment or Secrets Manager
            const host =
              configService.get<string>("DB_HOST") ||
              (await secretsService.getSecret("db-host"));
            const port =
              configService.get<number>("DB_PORT") ||
              (await secretsService.getSecret("db-port"));
            const username =
              configService.get<string>("DB_USERNAME") ||
              (await secretsService.getSecret("db-username"));
            const password =
              configService.get<string>("DB_PASSWORD") ||
              (await secretsService.getSecret("db-password"));
            const database =
              configService.get<string>("DB_NAME") ||
              (await secretsService.getSecret("db-name"));

            // Construct DATABASE_URL for notification_db schema
            const databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}?schema=notification_db`;
            process.env.DATABASE_URL = databaseUrl;

            return databaseUrl;
          },
          inject: [ConfigService, SecretsService],
        },
      ],
      exports: [PrismaService],
      global: true, // Make PrismaService available globally for dependency injection
    };
  }
}

