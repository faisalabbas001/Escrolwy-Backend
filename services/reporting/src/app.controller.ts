import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * Root Application Controller
 *
 * Provides basic service information endpoint.
 */
@ApiTags('app')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    @ApiOperation({ summary: 'Get service information' })
    getServiceInfo() {
        return this.appService.getServiceInfo();
    }
}
