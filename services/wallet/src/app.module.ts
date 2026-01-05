import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SecretsModule } from '@escrowly/shared-config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { HealthModule } from './health';
import { ConfigurationModule } from './config';
import { CryptoModule } from './crypto';
import { KafkaIntegrationModule } from './kafka';
import { ConsumersModule } from './consumers';
import { CronModule } from './cron';
import { PayoutsModule } from './payouts';
import { WalletsModule } from './wallets';

/**
 * Root Application Module
 *
 * Imports:
 * - ConfigModule: Environment variable management
 * - ScheduleModule: Cron job scheduling
 * - SecretsModule: Shared secrets management (from @escrowly/shared-config)
 * - PrismaModule: Database connection (wallet_db schema)
 * - RedisModule: Redis queue operations (BLPOP consumer)
 * - HealthModule: Health check endpoints
 * - ConfigurationModule: Chain and wallet configuration
 * - CryptoModule: Wallet generation and transaction execution
 * - KafkaIntegrationModule: Kafka event publishing
 * - ConsumersModule: Kafka and Redis event consumers
 * - CronModule: Scheduled jobs (withdrawal retry, deposit sweep)
 * - PayoutsModule: Payout query API
 */
@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // Enable cron job scheduling
    ScheduleModule.forRoot(),

    // Secrets management (global) - abstracts Secrets Manager / .env
    SecretsModule,

    // Database module (global)
    PrismaModule,

    // Redis module (global)
    RedisModule,

    // Health check module
    HealthModule,

    // Configuration module
    ConfigurationModule,

    // Crypto module (wallet generation, encryption, executors)
    CryptoModule,

    // Kafka integration module
    KafkaIntegrationModule,

    // Event consumers module
    ConsumersModule,

    // Cron jobs module
    CronModule,

    // Payouts API module
    PayoutsModule,

    // Wallets API module
    WalletsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

