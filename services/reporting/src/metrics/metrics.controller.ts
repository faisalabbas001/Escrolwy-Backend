import { Controller, Get, Query, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@escrowly/auth-common';
import { MetricsService } from './metrics.service';
import {
    MetricsQueryDto,
    ListenerMetricsDto,
    EventMetricsDto,
    ErrorMetricsDto,
    HotWalletMetricsDto,
    AuditMetricsDto,
} from './dto';

/**
 * Metrics Controller
 *
 * READ-ONLY endpoints for system and infrastructure health metrics.
 */
@ApiTags('metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({
    path: 'metrics',
    version: '1',
})
export class MetricsController {
    private readonly logger = new Logger(MetricsController.name);

    constructor(private readonly metricsService: MetricsService) { }

    @Get('listeners')
    @ApiOperation({ summary: 'Get listener health metrics' })
    @ApiResponse({ status: 200, description: 'Listener metrics', type: [ListenerMetricsDto] })
    async getListenerMetrics(@Query() query: MetricsQueryDto): Promise<ListenerMetricsDto[]> {
        this.logger.debug('Fetching listener metrics');
        return this.metricsService.getListenerMetrics(query);
    }

    @Get('events')
    @ApiOperation({ summary: 'Get event processing statistics' })
    @ApiResponse({ status: 200, description: 'Event metrics', type: [EventMetricsDto] })
    async getEventMetrics(): Promise<EventMetricsDto[]> {
        this.logger.debug('Fetching event metrics');
        return this.metricsService.getEventMetrics();
    }

    @Get('errors')
    @ApiOperation({ summary: 'Get error rate metrics' })
    @ApiResponse({ status: 200, description: 'Error metrics', type: [ErrorMetricsDto] })
    async getErrorMetrics(@Query() query: MetricsQueryDto): Promise<ErrorMetricsDto[]> {
        this.logger.debug('Fetching error metrics');
        return this.metricsService.getErrorMetrics(query);
    }

    @Get('hot-wallets')
    @ApiOperation({ summary: 'Get hot wallet balances' })
    @ApiResponse({ status: 200, description: 'Hot wallet metrics', type: [HotWalletMetricsDto] })
    async getHotWalletMetrics(@Query() query: MetricsQueryDto): Promise<HotWalletMetricsDto[]> {
        this.logger.debug('Fetching hot wallet metrics');
        return this.metricsService.getHotWalletMetrics(query);
    }

    @Get('audit')
    @ApiOperation({ summary: 'Get audit log metrics' })
    @ApiResponse({ status: 200, description: 'Audit metrics', type: [AuditMetricsDto] })
    async getAuditMetrics(): Promise<AuditMetricsDto[]> {
        this.logger.debug('Fetching audit metrics');
        return this.metricsService.getAuditMetrics();
    }
}
