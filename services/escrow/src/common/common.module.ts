import { Module } from '@nestjs/common';
import { PlatformFeesService } from './services/platform-fees.service';

@Module({
  providers: [PlatformFeesService],
  exports: [PlatformFeesService],
})
export class CommonModule {}
