import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { S2STokenInterceptor } from './interceptors/s2s-token.interceptor';

/**
 * Auth Common Module
 *
 * Provides authentication guards, interceptors, and utilities for all Escrowly microservices.
 * This module is global, so it only needs to be imported once in the root module.
 *
 * @example
 * ```typescript
 * // In your app.module.ts
 * import { AuthCommonModule } from '@escrowly/auth-common';
 *
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot(),
 *     AuthCommonModule,
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * ```typescript
 * // Apply guards and interceptors globally in main.ts
 * import { JwtAuthGuard, RolesGuard, S2STokenInterceptor } from '@escrowly/auth-common';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   const reflector = app.get(Reflector);
 *   const configService = app.get(ConfigService);
 *
 *   // Apply guards globally (JwtAuthGuard first, then RolesGuard)
 *   app.useGlobalGuards(
 *     new JwtAuthGuard(reflector, configService),
 *     new RolesGuard(reflector),
 *   );
 *
 *   // Apply S2S token interceptor globally (auto-issues tokens for service-only endpoints)
 *   app.useGlobalInterceptors(new S2STokenInterceptor(reflector, configService));
 *
 *   await app.listen(3000);
 * }
 * ```
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [JwtAuthGuard, RolesGuard, S2STokenInterceptor],
  exports: [JwtAuthGuard, RolesGuard, S2STokenInterceptor],
})
export class AuthCommonModule { }

