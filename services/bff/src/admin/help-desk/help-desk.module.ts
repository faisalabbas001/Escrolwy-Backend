import { Module } from '@nestjs/common';
import { HelpDeskController } from './help-desk.controller';

@Module({
  controllers: [HelpDeskController],
})
export class HelpDeskModule {}

