import { Controller, Get } from '@nestjs/common';
import { Public } from '@escrowly/auth-common';
import { AppService } from './app.service';
import { ApiServiceStatus } from './modules/app/docs/app.swagger';
import { AppApiTag } from './modules/app/docs/app.tags';

/**
 * App Controller
 *
 * Root controller for service status.
 * Public endpoint - no authentication required.
 */
@AppApiTag()
@Public()
@Controller({
  path: '',
  version: '1',
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiServiceStatus()
  getStatus() {
    return this.appService.getStatus();
  }
}
