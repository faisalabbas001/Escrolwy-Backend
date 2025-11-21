import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma Module
 *
 * @Global decorator makes PrismaService available across all modules
 * without needing to import PrismaModule in each module.
 *
 * This is the recommended pattern for shared services like database connections.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
