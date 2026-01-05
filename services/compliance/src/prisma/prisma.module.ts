import { Global, Module } from '@nestjs/common';
import { SecretsService } from '@escrowly/shared-config';
import { PrismaService } from './prisma.service';

/**
 * Prisma Module
 *
 * @Global decorator makes PrismaService available across all modules
 * without needing to import PrismaModule in each module.
 */
@Global()
@Module({
    providers: [
        {
            provide: PrismaService,
            useFactory: async (secretsService: SecretsService) => {
                // Set DATABASE_URL before creating PrismaService
                const dbUrl = await secretsService.getDatabaseUrl();
                process.env.DATABASE_URL = dbUrl;
                console.log('🔗 Compliance DB URL set');
                return new PrismaService(secretsService);
            },
            inject: [SecretsService],
        },
    ],
    exports: [PrismaService],
})
export class PrismaModule { }
