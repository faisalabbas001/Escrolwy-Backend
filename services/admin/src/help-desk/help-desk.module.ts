import { Module } from '@nestjs/common';
import { HelpDeskService } from './help-desk.service';
import { HelpDeskController } from './help-desk.controller';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [HelpDeskController],
  providers: [HelpDeskService],
  exports: [HelpDeskService],
})
export class HelpDeskModule {}

