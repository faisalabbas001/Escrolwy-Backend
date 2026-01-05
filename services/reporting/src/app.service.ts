import { Injectable } from '@nestjs/common';

/**
 * Root Application Service
 *
 * Provides basic service information.
 */
@Injectable()
export class AppService {
    getServiceInfo() {
        return {
            service: 'reporting-service',
            version: '1.0.0',
            description: 'Reporting and analytics service for Escrowly platform',
        };
    }
}
