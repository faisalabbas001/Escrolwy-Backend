import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AlertsService } from '../alerts';

import { ReportingEventProducer } from '../kafka/reporting-event.producer';
import { ServiceConfig, ServiceHealthStatus } from './dto';

/**
 * Service Health Monitor
 *
 * Monitors the health of all internal services every 1 minute.
 * Calls S2S health endpoints and generates alerts for DOWN services.
 */
@Injectable()
export class ServiceHealthMonitor {
    private readonly logger = new Logger(ServiceHealthMonitor.name);

    // Service configuration - discovered from services folder
    private readonly SERVICES: ServiceConfig[] = [
        { name: 'auth', port: 3000, healthPath: '/api/v1/health/live' },
        { name: 'admin', port: 3001, healthPath: '/api/v1/health/live' },
        { name: 'escrow', port: 3002, healthPath: '/api/v1/health/live' },
        { name: 'ledger', port: 3003, healthPath: '/api/v1/health/live' },
        { name: 'compliance', port: 3004, healthPath: '/api/v1/health/live' },
        { name: 'inquiry', port: 3005, healthPath: '/api/v1/health/live' },
        { name: 'bff', port: 3006, healthPath: '/api/v1/health/live' },
        { name: 'notification', port: 3008, healthPath: '/api/v1/health' },
    ];

    // Track last alert time to avoid spam
    private lastAlertTime: Map<string, Date> = new Map();
    private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

    constructor(
        private readonly httpService: HttpService,
        private readonly alertsService: AlertsService,
        private readonly reportingEventProducer: ReportingEventProducer,
    ) { }

    /**
     * Cron job: Check all services health every 1 minute
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async checkAllServicesHealth(): Promise<void> {
        this.logger.log('Starting health check for all services...');

        const results: ServiceHealthStatus[] = [];

        // Check all services in parallel (non-blocking)
        const promises = this.SERVICES.map(service =>
            this.checkServiceHealth(service).catch(error => {
                this.logger.error(`Failed to check ${service.name}: ${error.message}`);
                return {
                    serviceName: service.name,
                    status: 'DOWN' as const,
                    lastChecked: new Date().toISOString(),
                    failureReason: 'check_failed',
                };
            })
        );

        const statuses = await Promise.all(promises);
        results.push(...statuses);

        // Log summary
        const downServices = results.filter(r => r.status === 'DOWN');
        if (downServices.length > 0) {
            this.logger.warn(`Health check complete: ${downServices.length} services DOWN`);
        } else {
            this.logger.log('Health check complete: All services UP');
        }
    }

    /**
     * Check health of a single service
     */
    private async checkServiceHealth(service: ServiceConfig): Promise<ServiceHealthStatus> {
        const url = `http://localhost:${service.port}${service.healthPath}`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    timeout: 5000,
                    validateStatus: (status) => status === 200,
                })
            );

            this.logger.debug(`${service.name} is UP (${response.status})`);

            return {
                serviceName: service.name,
                status: 'UP',
                lastChecked: new Date().toISOString(),
            };
        } catch (error: any) {
            const failureReason = this.getFailureReason(error);

            this.logger.warn(`${service.name} is DOWN: ${failureReason}`);

            // Create alert if not in cooldown
            await this.createServiceDownAlert(service, failureReason);

            return {
                serviceName: service.name,
                status: 'DOWN',
                lastChecked: new Date().toISOString(),
                failureReason,
            };
        }
    }

    /**
     * Determine failure reason from error
     */
    private getFailureReason(error: any): string {
        if (error.code === 'ECONNREFUSED') {
            return 'connection_refused';
        } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
            return 'timeout';
        } else if (error.response?.status) {
            return `unhealthy_response_${error.response.status}`;
        } else {
            return 'unknown_error';
        }
    }

    /**
     * Create alert for DOWN service
     */
    private async createServiceDownAlert(
        service: ServiceConfig,
        failureReason: string,
    ): Promise<void> {
        // Check cooldown to avoid alert spam
        const lastAlert = this.lastAlertTime.get(service.name);
        if (lastAlert && Date.now() - lastAlert.getTime() < this.ALERT_COOLDOWN_MS) {
            this.logger.debug(`Skipping alert for ${service.name} (cooldown)`);
            return;
        }

        try {
            const alert = await this.alertsService.createAlert({
                alertType: 'SERVICE_DOWN',
                source: service.name,
                severity: 'CRITICAL',
                description: `Service ${service.name} is DOWN (${failureReason})`,
                metadata: {
                    serviceName: service.name,
                    servicePort: service.port,
                    healthEndpoint: service.healthPath,
                    failureReason,
                    timestamp: new Date().toISOString(),
                },
            });

            // Publish alert event
            await this.reportingEventProducer.alertTriggered(
                alert.id,
                alert.alertType,
                alert.source,
                alert.severity,
                alert.description,
            );

            this.lastAlertTime.set(service.name, new Date());
            this.logger.log(`Alert created for ${service.name}`);
        } catch (error: any) {
            this.logger.error(`Failed to create alert for ${service.name}: ${error.message}`);
        }
    }
}
