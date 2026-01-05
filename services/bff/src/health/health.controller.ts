import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth() {
    return {
      status: 'ok',
      service: this.configService.get<string>('SERVICE_NAME', 'bff-service'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  getReadiness() {
    return {
      status: 'ready',
      authService: this.configService.get<string>('AUTH_SERVICE_URL'),
      adminService: this.configService.get<string>('ADMIN_SERVICE_URL'),
    };
  }
}

