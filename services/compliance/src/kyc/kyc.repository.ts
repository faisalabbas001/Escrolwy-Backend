import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * KYC Repository
 *
 * Handles all database operations for KYC records.
 */
@Injectable()
export class KycRepository {
    private readonly logger = new Logger(KycRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Find KYC record by user ID
     */
    async findByUserId(userId: string) {
        return this.prisma.kycRecord.findUnique({
            where: { userId },
            include: {
                risks: true,
                limits: true,
            },
        });
    }

    /**
     * Find KYC record by Persona inquiry ID
     */
    async findByPersonaInquiryId(inquiryId: string) {
        return this.prisma.kycRecord.findFirst({
            where: { personaInquiryId: inquiryId },
            include: {
                risks: true,
                limits: true,
            },
        });
    }

    /**
     * Create a new KYC record
     */
    async create(data: {
        userId: string;
        personaInquiryId: string;
        referenceId?: string;
        status?: string;
        metadata?: any;
    }) {
        return this.prisma.kycRecord.create({
            data: {
                userId: data.userId,
                personaInquiryId: data.personaInquiryId,
                referenceId: data.referenceId,
                status: data.status || 'STARTED',
                metadata: data.metadata,
            },
        });
    }

    /**
     * Update KYC record status
     */
    async updateStatus(
        userId: string,
        status: string,
        metadata?: any,
    ) {
        return this.prisma.kycRecord.update({
            where: { userId },
            data: {
                status,
                metadata: metadata ? metadata : undefined,
            },
        });
    }

    /**
     * Update KYC record by inquiry ID
     */
    async updateByInquiryId(
        inquiryId: string,
        data: {
            status: string;
            metadata?: any;
        },
    ) {
        return this.prisma.kycRecord.updateMany({
            where: { personaInquiryId: inquiryId },
            data: {
                status: data.status,
                metadata: data.metadata,
            },
        });
    }

    /**
     * Check if user already has a KYC record
     */
    async exists(userId: string): Promise<boolean> {
        const record = await this.prisma.kycRecord.findUnique({
            where: { userId },
            select: { id: true },
        });
        return !!record;
    }

    /**
     * Create risk record
     */
    async createRisk(data: {
        userId: string;
        kycRecordId: string;
        riskType: string;
        severity: string;
        source?: string;
        details?: any;
    }) {
        return this.prisma.risk.create({
            data: {
                userId: data.userId,
                kycRecordId: data.kycRecordId,
                riskType: data.riskType,
                severity: data.severity,
                source: data.source || 'persona',
                details: data.details,
            },
        });
    }

    /**
     * Create or update user limits
     */
    async upsertLimits(data: {
        userId: string;
        kycRecordId: string;
        escrowLimit: number;
        ledgerLimit: number;
    }) {
        return this.prisma.userLimit.upsert({
            where: { userId: data.userId },
            create: {
                userId: data.userId,
                kycRecordId: data.kycRecordId,
                escrowLimit: data.escrowLimit,
                ledgerLimit: data.ledgerLimit,
            },
            update: {
                escrowLimit: data.escrowLimit,
                ledgerLimit: data.ledgerLimit,
            },
        });
    }
}
