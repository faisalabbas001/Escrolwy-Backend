import { Controller, Get } from '@nestjs/common';
import { Public } from '@escrowly/auth-common';
import { AppService } from './app.service';

@Public()
@Controller({
  path: '',
  version: '1',
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus() {
    return this.appService.getStatus();
  }
}

