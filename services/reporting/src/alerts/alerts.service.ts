import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import {
    AlertQueryDto,
    AcknowledgeAlertDto,
    UpdateAlertRuleDto,
    AlertDto,
    AlertRuleDto,
    AlertAcknowledgeResponseDto,
    AlertStatus,
    CreateAlertRuleDto,
} from './dto';

/**
 * Alerts Service
 *
 * Service for alert management and anomaly detection.
 */
@Injectable()
export class AlertsService {
    private readonly logger = new Logger(AlertsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getAlerts(query: AlertQueryDto): Promise<AlertDto[]> {
        try {
            const where: any = {};
            if (query.status) where.status = query.status;
            if (query.severity) where.severity = query.severity;
            if (query.alertType) where.alertType = query.alertType;

            // Default to active alerts
            if (!query.status) where.status = AlertStatus.ACTIVE;

            const alerts = await this.prisma.alert.findMany({
                where,
                orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
                take: query.limit || 50,
            });

            return alerts.map(this.mapToDto);
        } catch (error) {
            this.logger.error('Error fetching alerts', error);
            return [];
        }
    }

    async acknowledgeAlert(alertId: string, dto: AcknowledgeAlertDto): Promise<AlertAcknowledgeResponseDto> {
        try {
            const alert = await this.prisma.alert.findUnique({ where: { id: alertId } });

            if (!alert) {
                throw new NotFoundException(`Alert ${alertId} not found`);
            }

            const updated = await this.prisma.alert.update({
                where: { id: alertId },
                data: {
                    status: AlertStatus.ACKNOWLEDGED,
                    metadata: {
                        ...(alert.metadata as object || {}),
                        acknowledgedAt: new Date().toISOString(),
                        acknowledgeNote: dto.note,
                    },
                },
            });

            return {
                success: true,
                message: 'Alert acknowledged successfully',
                alertId,
                newStatus: updated.status,
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error(`Error acknowledging alert ${alertId}`, error);
            throw error;
        }
    }

    async getAlertHistory(query: AlertQueryDto): Promise<AlertDto[]> {
        try {
            const where: any = {};
            if (query.severity) where.severity = query.severity;
            if (query.alertType) where.alertType = query.alertType;

            // Include all statuses for history
            const alerts = await this.prisma.alert.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: query.limit || 100,
            });

            return alerts.map(this.mapToDto);
        } catch (error) {
            this.logger.error('Error fetching alert history', error);
            return [];
        }
    }

    async getAlertRules(): Promise<AlertRuleDto[]> {
        try {
            const rules = await this.prisma.alertRule.findMany({
                orderBy: { ruleType: 'asc' },
            });

            return rules.map((r) => ({
                id: r.id,
                ruleType: r.ruleType,
                conditionExpression: r.conditionExpression,
                threshold: Number(r.threshold),
                severity: r.severity,
                action: r.action,
                isActive: r.isActive,
                updatedAt: r.updatedAt.toISOString(),
            }));
        } catch (error) {
            this.logger.error('Error fetching alert rules', error);
            return [];
        }
    }

    async createAlertRule(dto: CreateAlertRuleDto): Promise<AlertRuleDto> {
        const existing = await this.prisma.alertRule.findUnique({
            where: { ruleType: dto.ruleType },
        });

        if (existing) {
            throw new NotFoundException(`Alert rule for ${dto.ruleType} already exists`);
        }

        const rule = await this.prisma.alertRule.create({
            data: {
                ruleType: dto.ruleType,
                conditionExpression: dto.conditionExpression,
                threshold: dto.threshold,
                severity: dto.severity,
                action: dto.action,
                isActive: dto.isActive ?? true,
            },
        });

        this.logger.log(`Created new alert rule: ${rule.ruleType}`);

        return {
            id: rule.id,
            ruleType: rule.ruleType,
            conditionExpression: rule.conditionExpression,
            threshold: Number(rule.threshold),
            severity: rule.severity,
            action: rule.action,
            isActive: rule.isActive,
            updatedAt: rule.updatedAt.toISOString(),
        };
    }

    async updateAlertRule(ruleId: string, dto: UpdateAlertRuleDto): Promise<AlertRuleDto> {
        const rule = await this.prisma.alertRule.findUnique({ where: { id: ruleId } });

        if (!rule) {
            throw new NotFoundException(`Alert rule ${ruleId} not found`);
        }

        const updateData: any = {};
        if (dto.conditionExpression !== undefined) updateData.conditionExpression = dto.conditionExpression;
        if (dto.threshold !== undefined) updateData.threshold = dto.threshold;
        if (dto.severity !== undefined) updateData.severity = dto.severity;
        if (dto.action !== undefined) updateData.action = dto.action;
        if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

        const updated = await this.prisma.alertRule.update({
            where: { id: ruleId },
            data: updateData,
        });

        return {
            id: updated.id,
            ruleType: updated.ruleType,
            conditionExpression: updated.conditionExpression,
            threshold: Number(updated.threshold),
            severity: updated.severity,
            action: updated.action,
            isActive: updated.isActive,
            updatedAt: updated.updatedAt.toISOString(),
        };
    }

    /**
     * Create a new alert (called by Kafka consumers)
     * Note: This does NOT publish alert.triggered event to avoid circular dependency.
     * The event should be published separately by the caller if needed.
     */
    async createAlert(data: {
        alertType: string;
        source: string;
        severity: string;
        description: string;
        metadata?: any;
    }): Promise<AlertDto> {
        const alert = await this.prisma.alert.create({
            data: {
                alertType: data.alertType,
                source: data.source,
                severity: data.severity,
                description: data.description,
                status: AlertStatus.ACTIVE,
                metadata: data.metadata || {},
            },
        });

        this.logger.log(`Alert created: ${alert.alertType} - ${alert.id}`);
        return this.mapToDto(alert);
    }

    /**
     * Resolve an alert
     */
    async resolveAlert(alertId: string): Promise<AlertDto> {
        const updated = await this.prisma.alert.update({
            where: { id: alertId },
            data: {
                status: AlertStatus.RESOLVED,
                resolvedAt: new Date(),
            },
        });

        return this.mapToDto(updated);
    }

    private mapToDto(alert: any): AlertDto {
        return {
            id: alert.id,
            alertType: alert.alertType,
            source: alert.source,
            severity: alert.severity,
            description: alert.description,
            status: alert.status,
            metadata: alert.metadata,
            createdAt: alert.createdAt.toISOString(),
            resolvedAt: alert.resolvedAt?.toISOString(),
        };
    }
}
