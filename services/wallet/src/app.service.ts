import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getInfo(): object {
    return {
      service: this.configService.get<string>('SERVICE_NAME', 'wallet-service'),
      version: '1.0.0',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      description: 'Escrowly Wallet Service - Blockchain execution engine',
      features: [
        'Custodial wallet generation (EVM, Solana, Tron)',
        'Deposit processing from Redis queue',
        'On-chain withdrawal execution',
        'Automated deposit sweeps',
        'Withdrawal retry mechanism',
      ],
    };
  }
}

