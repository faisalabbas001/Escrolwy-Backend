import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [InternalController],
  providers: [InternalService],
  exports: [InternalService],
})
export class InternalModule {}
