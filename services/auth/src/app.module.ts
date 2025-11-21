import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsModule } from '@escrowly/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { HealthModule } from './health';

/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - SecretsModule: Shared secrets management (from @escrowly/shared-config)
 * - PrismaModule: Database connection (auth_db schema)
 * - HealthModule: Health check endpoints
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

    // Database module (global)
    PrismaModule,

    // Health check module
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
