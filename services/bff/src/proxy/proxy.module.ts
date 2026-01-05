import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from './proxy.service';

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
    }),
  ],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}

