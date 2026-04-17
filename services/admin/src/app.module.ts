import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsModule } from '@escrowly/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { HealthModule } from './health';
import { BlogModule } from './blog';
import { UploadModule } from './upload';
import { HelpDeskModule } from './help-desk';
import { CacheModule } from './cache';

/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - SecretsModule: Shared secrets management (from @escrowly/shared-config)
 * - PrismaModule: Database connection (admin_db schema)
 * - HealthModule: Health check endpoints
 * - BlogModule: Blog CRUD operations
 */
@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // Secrets management (global) - abstracts Secrets Manager / .env
    SecretsModule,

    // Redis cache module (global)
    CacheModule,

    // Database module (global)
    PrismaModule,

    // Health check module
    HealthModule,

    // Blog module
    BlogModule,

    // Upload module (AWS S3)
    UploadModule,

    // Help Desk module
    HelpDeskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

