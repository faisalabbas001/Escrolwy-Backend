import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ComplianceEventProducer } from '../kafka/compliance-event.producer';
import { AuditService, AuditAction } from '../audit';

/**
 * Admin Service
 *
 * Handles admin operations for compliance:
 * - Review flagged users
 * - Approve/reject KYC manually
 * - Adjust user limits
 * - Reset KYC (exceptional cases)
 * 
 * All operations are logged to the audit trail.
 */
@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventProducer: ComplianceEventProducer,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Get list of users with REVIEW_REQUIRED status
     */
    async getFlaggedUsers() {
        const flaggedRecords = await this.prisma.kycRecord.findMany({
            where: { status: 'REVIEW_REQUIRED' },
            include: {
                risks: true,
                limits: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return flaggedRecords.map((record) => ({
            userId: record.userId,
            inquiryId: record.personaInquiryId,
            status: record.status,
            risks: record.risks,
            limits: record.limits,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        }));
    }

    /**
     * Manually approve a flagged user's KYC
     */
    async approveKyc(userId: string, reason?: string) {
        const kycRecord = await this.prisma.kycRecord.findUnique({
            where: { userId },
        });

        if (!kycRecord) {
            throw new NotFoundException(`KYC record not found for user ${userId}`);
        }

        if (kycRecord.status === 'APPROVED') {
            throw new BadRequestException('User is already approved');
        }

        // Update KYC status
        await this.prisma.kycRecord.update({
            where: { userId },
            data: {
                status: 'APPROVED',
                metadata: {
                    ...(kycRecord.metadata as object || {}),
                    manualApproval: {
                        reason,
                        approvedAt: new Date().toISOString(),
                    },
                },
            },
        });

        // Create/update limits (default limits for manual approval)
        const defaultEscrowLimit = 50000;
        const defaultLedgerLimit = 100000;

        await this.prisma.userLimit.upsert({
            where: { userId },
            create: {
                userId,
                kycRecordId: kycRecord.id,
                escrowLimit: defaultEscrowLimit,
                ledgerLimit: defaultLedgerLimit,
            },
            update: {
                escrowLimit: defaultEscrowLimit,
                ledgerLimit: defaultLedgerLimit,
            },
        });

        // Emit events
        await this.eventProducer.kycApproved(
            userId,
            kycRecord.personaInquiryId || 'manual',
            { escrowLimit: defaultEscrowLimit, ledgerLimit: defaultLedgerLimit },
        );

        await this.eventProducer.limitsUpdated(userId, defaultEscrowLimit, defaultLedgerLimit);

        // Audit log
        await this.auditService.log({
            userId,
            action: AuditAction.ADMIN_APPROVE,
            details: {
                reason,
                previousStatus: kycRecord.status,
                newStatus: 'APPROVED',
                limits: { escrowLimit: defaultEscrowLimit, ledgerLimit: defaultLedgerLimit },
            },
        });

        this.logger.log(`KYC manually approved for user ${userId}`);

        return {
            success: true,
            userId,
            status: 'APPROVED',
            limits: {
                escrowLimit: defaultEscrowLimit,
                ledgerLimit: defaultLedgerLimit,
            },
        };
    }

    /**
     * Manually reject a user's KYC
     */
    async rejectKyc(userId: string, reason?: string) {
        const kycRecord = await this.prisma.kycRecord.findUnique({
            where: { userId },
        });

        if (!kycRecord) {
            throw new NotFoundException(`KYC record not found for user ${userId}`);
        }

        if (kycRecord.status === 'REJECTED') {
            throw new BadRequestException('User is already rejected');
        }

        // Update KYC status
        await this.prisma.kycRecord.update({
            where: { userId },
            data: {
                status: 'REJECTED',
                metadata: {
                    ...(kycRecord.metadata as object || {}),
                    manualRejection: {
                        reason,
                        rejectedAt: new Date().toISOString(),
                    },
                },
            },
        });

        // Remove limits if any
        await this.prisma.userLimit.deleteMany({
            where: { userId },
        });

        // Emit event
        await this.eventProducer.kycRejected(
            userId,
            kycRecord.personaInquiryId || 'manual',
            reason,
        );

        // Audit log
        await this.auditService.log({
            userId,
            action: AuditAction.ADMIN_REJECT,
            details: {
                reason,
                previousStatus: kycRecord.status,
                newStatus: 'REJECTED',
            },
        });

        this.logger.log(`KYC manually rejected for user ${userId}`);

        return {
            success: true,
            userId,
            status: 'REJECTED',
            reason,
        };
    }

    /**
     * Adjust user limits
     */
    async adjustLimits(
        userId: string,
        escrowLimit?: number,
        ledgerLimit?: number,
    ) {
        const kycRecord = await this.prisma.kycRecord.findUnique({
            where: { userId },
        });

        if (!kycRecord) {
            throw new NotFoundException(`KYC record not found for user ${userId}`);
        }

        if (kycRecord.status !== 'APPROVED') {
            throw new BadRequestException('Cannot adjust limits for non-approved users');
        }

        const existingLimits = await this.prisma.userLimit.findUnique({
            where: { userId },
        });

        const newEscrowLimit = escrowLimit ?? Number(existingLimits?.escrowLimit || 0);
        const newLedgerLimit = ledgerLimit ?? Number(existingLimits?.ledgerLimit || 0);

        await this.prisma.userLimit.upsert({
            where: { userId },
            create: {
                userId,
                kycRecordId: kycRecord.id,
                escrowLimit: newEscrowLimit,
                ledgerLimit: newLedgerLimit,
            },
            update: {
                escrowLimit: newEscrowLimit,
                ledgerLimit: newLedgerLimit,
            },
        });

        // Emit event
        await this.eventProducer.limitsUpdated(userId, newEscrowLimit, newLedgerLimit);

        // Audit log
        await this.auditService.log({
            userId,
            action: AuditAction.ADMIN_ADJUST_LIMITS,
            details: {
                previousLimits: {
                    escrowLimit: Number(existingLimits?.escrowLimit || 0),
                    ledgerLimit: Number(existingLimits?.ledgerLimit || 0),
                },
                newLimits: { escrowLimit: newEscrowLimit, ledgerLimit: newLedgerLimit },
            },
        });

        this.logger.log(`Limits adjusted for user ${userId}: escrow=${newEscrowLimit}, ledger=${newLedgerLimit}`);

        return {
            success: true,
            userId,
            escrowLimit: newEscrowLimit,
            ledgerLimit: newLedgerLimit,
        };
    }

    /**
     * Reset KYC for a user (exceptional cases)
     */
    async resetKyc(userId: string, reason: string) {
        const kycRecord = await this.prisma.kycRecord.findUnique({
            where: { userId },
        });

        if (!kycRecord) {
            throw new NotFoundException(`KYC record not found for user ${userId}`);
        }

        // Delete related records
        await this.prisma.risk.deleteMany({
            where: { userId },
        });

        await this.prisma.userLimit.deleteMany({
            where: { userId },
        });

        await this.prisma.kycRecord.delete({
            where: { userId },
        });

        // Audit log
        await this.auditService.log({
            userId,
            action: AuditAction.KYC_RESET,
            details: {
                reason,
                previousStatus: kycRecord.status,
            },
        });

        this.logger.log(`KYC reset for user ${userId}. Reason: ${reason}`);

        return {
            success: true,
            userId,
            message: 'KYC has been reset. User can now start a new KYC process.',
            reason,
        };
    }
}
