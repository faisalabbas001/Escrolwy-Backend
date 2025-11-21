import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SecretsService } from "./secrets.service";

/**
 * Shared Secrets Module
 *
 * Provides centralized secrets management for ALL Escrowly services.
 *
 * @Global decorator makes SecretsService available across all modules
 * without needing to import SecretsModule in each module.
 *
 * Usage in any service:
 * ```typescript
 * import { SecretsModule } from '@escrowly/shared-config';
 *
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot({ isGlobal: true }),
 *     SecretsModule,
 *     // ...
 *   ],
 * })
 * ```
 */
@Global()
@Module({
  imports: [ConfigModule], // Import ConfigModule to ensure ConfigService is available
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
