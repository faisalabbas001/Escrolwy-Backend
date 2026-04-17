import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { ServiceHealthMonitor } from './service-health-monitor.service';
import { HotWalletMonitor } from './hot-wallet-monitor.service';
import { AlertsModule } from '../alerts';
import { KafkaEventsModule } from '../kafka';

/**
 * Monitoring Module
 *
 * Provides automated monitoring and alerting:
 * - Service health checks (every 1 minute)
 * - Hot wallet balance checks (every 3 hours)
 */
@Module({
    imports: [
        ScheduleModule.forRoot(),
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 0,
        }),
        AlertsModule,
        KafkaEventsModule,
    ],
    providers: [ServiceHealthMonitor, HotWalletMonitor],
    exports: [ServiceHealthMonitor, HotWalletMonitor],
})
export class MonitoringModule { }
