import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      service: 'ledger',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }
}

