import { Controller, Get } from '@nestjs/common';
import { Public } from '@escrowly/auth-common';
import { HealthService } from './health.service';
import { ApiHealthCheck, ApiHealthReady } from './docs/health.swagger';
import { HealthCheckApiTag } from './docs/health.tags';

@HealthCheckApiTag()
@Public()
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiHealthCheck()
  healthCheck() {
    return this.healthService.getHealthStatus();
  }

  @Get('ready')
  @ApiHealthReady()
  readinessCheck() {
    return this.healthService.getReadiness();
  }
}

