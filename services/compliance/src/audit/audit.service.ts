import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * Audit Actions Enum
 */
export enum AuditAction {
    KYC_STARTED = 'KYC_STARTED',
    KYC_APPROVED = 'KYC_APPROVED',
    KYC_REJECTED = 'KYC_REJECTED',
    KYC_REVIEW_REQUIRED = 'KYC_REVIEW_REQUIRED',
    KYC_RESET = 'KYC_RESET',
    LIMITS_CREATED = 'LIMITS_CREATED',
    LIMITS_UPDATED = 'LIMITS_UPDATED',
    WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
    ADMIN_APPROVE = 'ADMIN_APPROVE',
    ADMIN_REJECT = 'ADMIN_REJECT',
    ADMIN_ADJUST_LIMITS = 'ADMIN_ADJUST_LIMITS',
}

/**
 * Audit Service
 * 
 * Logs all compliance-critical actions for regulatory audit trail.
 * Provides traceability for:
 * - KYC lifecycle events
 * - Limits changes
 * - Admin actions
 * - Webhook processing
 */
@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Log an audit event
     */
    async log(params: {
        userId: string;
        action: AuditAction;
        details?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    userId: params.userId,
                    action: params.action,
                    details: params.details || {},
                    ipAddress: params.ipAddress,
                    userAgent: params.userAgent,
                },
            });

            this.logger.debug(
                `📝 Audit: ${params.action} for user ${params.userId}`,
            );
        } catch (error: any) {
            // Don't throw - audit logging should not break main flow
            this.logger.error(
                `Failed to write audit log: ${error.message}`,
                error.stack,
            );
        }
    }

    /**
     * Get audit logs for a user
     */
    async getLogsForUser(
        userId: string,
        options?: { limit?: number; offset?: number },
    ) {
        return this.prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        });
    }

    /**
     * Get audit logs by action type
     */
    async getLogsByAction(
        action: AuditAction,
        options?: { limit?: number; offset?: number },
    ) {
        return this.prisma.auditLog.findMany({
            where: { action },
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        });
    }
}
