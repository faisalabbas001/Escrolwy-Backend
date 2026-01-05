import { Controller, Get, Post, Put, Param, Query, Body, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@escrowly/auth-common';
import { AlertsService } from 'src/alerts/alerts.service';
import {
    AlertQueryDto,
    AcknowledgeAlertDto,
    UpdateAlertRuleDto,
    AlertDto,
    AlertRuleDto,
    AlertAcknowledgeResponseDto,
    CreateAlertRuleDto,
} from './dto';

/**
 * Alerts Controller
 *
 * Endpoints for alert management and anomaly detection.
 * Mostly READ-ONLY, except for acknowledge and rule updates.
 */
@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({
    path: 'alerts',
    version: '1',
})
export class AlertsController {
    private readonly logger = new Logger(AlertsController.name);

    constructor(private readonly alertsService: AlertsService) { }

    @Get()
    @ApiOperation({ summary: 'Get active alerts' })
    @ApiResponse({ status: 200, description: 'List of alerts', type: [AlertDto] })
    async getAlerts(@Query() query: AlertQueryDto): Promise<AlertDto[]> {
        this.logger.debug('Fetching alerts');
        return this.alertsService.getAlerts(query);
    }

    @Post('acknowledge/:alertId')
    @ApiOperation({ summary: 'Acknowledge an alert' })
    @ApiParam({ name: 'alertId', description: 'Alert ID to acknowledge' })
    @ApiResponse({ status: 200, description: 'Alert acknowledged', type: AlertAcknowledgeResponseDto })
    async acknowledgeAlert(
        @Param('alertId') alertId: string,
        @Body() dto: AcknowledgeAlertDto,
    ): Promise<AlertAcknowledgeResponseDto> {
        this.logger.debug(`Acknowledging alert ${alertId}`);
        return this.alertsService.acknowledgeAlert(alertId, dto);
    }

    @Get('history')
    @ApiOperation({ summary: 'Get alert history' })
    @ApiResponse({ status: 200, description: 'Alert history', type: [AlertDto] })
    async getAlertHistory(@Query() query: AlertQueryDto): Promise<AlertDto[]> {
        this.logger.debug('Fetching alert history');
        return this.alertsService.getAlertHistory(query);
    }

    @Get('rules')
    @ApiOperation({ summary: 'Get alert rules' })
    @ApiResponse({ status: 200, description: 'Alert rules', type: [AlertRuleDto] })
    async getAlertRules(): Promise<AlertRuleDto[]> {
        this.logger.debug('Fetching alert rules');
        return this.alertsService.getAlertRules();
    }

    @Post('rules')
    @ApiOperation({ summary: 'Create alert rule' })
    @ApiResponse({ status: 201, description: 'Created rule', type: AlertRuleDto })
    async createAlertRule(@Body() dto: CreateAlertRuleDto): Promise<AlertRuleDto> {
        this.logger.debug('Creating alert rule');
        return this.alertsService.createAlertRule(dto);
    }

    @Put('rules/:ruleId')
    @ApiOperation({ summary: 'Update alert rule' })
    @ApiParam({ name: 'ruleId', description: 'Rule ID to update' })
    @ApiResponse({ status: 200, description: 'Updated rule', type: AlertRuleDto })
    async updateAlertRule(
        @Param('ruleId') ruleId: string,
        @Body() dto: UpdateAlertRuleDto,
    ): Promise<AlertRuleDto> {
        this.logger.debug(`Updating alert rule ${ruleId}`);
        return this.alertsService.updateAlertRule(ruleId, dto);
    }
}
