import { Global, Module } from '@nestjs/common';
import { SecretsModule, SecretsService } from '@escrowly/shared-config';
import { PrismaService } from './prisma.service';

/**
 * Database Module
 *
 * @Global decorator makes PrismaService available across all modules
 * without needing to import DatabaseModule in each module.
 *
 * This is the recommended pattern for shared services like database connections.
 */
@Global()
@Module({
  imports: [SecretsModule],
  providers: [
    {
      provide: PrismaService,
      useFactory: async (secretsService: SecretsService) => {
        // Set DATABASE_URL before creating PrismaService
        // This ensures PrismaClient reads the correct URL at construction time
        const dbUrl = await secretsService.getDatabaseUrl();
        process.env.DATABASE_URL = dbUrl;
        console.log('🔗 Final Database URL:', dbUrl);
        return new PrismaService(secretsService);
      },
      inject: [SecretsService],
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}

