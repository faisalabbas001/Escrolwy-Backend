import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * Root App Controller
 *
 * Provides basic service information endpoint.
 */
@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get service info' })
  @ApiResponse({ status: 200, description: 'Service information' })
  getInfo() {
    return this.appService.getInfo();
  }
}

