import { Injectable } from '@nestjs/common';


@Injectable()
export class AppService {
  getStatus(): Record<string, any> {
    return {
      message: 'Escrow service is running',
      service: 'escrow',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
