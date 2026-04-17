import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

/**
 * Config Module
 *
 * Provides configuration management for the listener-engine service.
 * Loads environment variables and makes them available globally.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}

