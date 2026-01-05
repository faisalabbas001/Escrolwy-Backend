import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Root App Service
 *
 * Provides basic service information.
 */
@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getInfo() {
    return {
      service: 'listener-engine',
      version: '1.0.0',
      chain: this.configService.get<string>('CHAIN', 'eth'),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
    };
  }
}

