import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsModule } from '@escrowly/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { HealthModule } from './health';
import { ListenerModule } from './listener';

/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - SecretsModule: Shared secrets management (from @escrowly/shared-config)
 * - PrismaModule: Database connection (listener_engine_db schema)
 * - RedisModule: Redis queue operations
 * - HealthModule: Health check endpoints
 * - ListenerModule: Blockchain listener (auto-starts on init)
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

    // Redis module (global)
    RedisModule,

    // Health check module
    HealthModule,

    // Listener module (auto-starts blockchain listener)
    ListenerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
