import {
    Injectable,
    Logger,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { KycRepository } from './kyc.repository';
import { WebhookRepository } from './webhook.repository';
import { OutboxRepository } from './outbox.repository';
import { PersonaService } from '../persona';
import { PersonaWebhookPayload } from '../persona';
import { KycStatus, StartKycResponseDto, KycStatusResponseDto } from './dto';

// Default limits for approved users
const DEFAULT_ESCROW_LIMIT = 50000;
const DEFAULT_LEDGER_LIMIT = 100000;
const REDUCED_LIMIT_FACTOR = 0.5; // 50% of default if risk flags present

/**
 * KYC Service
 *
 * Business logic for KYC lifecycle management.
 */
@Injectable()
export class KycService {
    private readonly logger = new Logger(KycService.name);

    constructor(
        private readonly kycRepository: KycRepository,
        private readonly webhookRepository: WebhookRepository,
        private readonly outboxRepository: OutboxRepository,
        private readonly personaService: PersonaService,
    ) { }

    /**
     * Start KYC process for a user
     */
    async startKyc(
        userId: string,
        referenceId?: string,
        redirectUri?: string,
    ): Promise<StartKycResponseDto> {
        // Check if user already has a KYC record
        const existingRecord = await this.kycRepository.findByUserId(userId);

        if (existingRecord) {
            // If already approved, don't allow restart
            if (existingRecord.status === 'APPROVED') {
                throw new ConflictException('KYC already approved');
            }
            // If already started, return existing inquiry
            if (existingRecord.personaInquiryId) {
                const verificationUrl = `https://withpersona.com/verify?inquiry-id=${existingRecord.personaInquiryId}`;
                return {
                    success: true,
                    status: KycStatus.STARTED,
                    personaInquiryId: existingRecord.personaInquiryId,
                    verificationUrl,
                };
            }
        }

        // Create Persona inquiry
        const { inquiryId, verificationUrl } = await this.personaService.createInquiry(
            userId,
            referenceId,
        );

        // Create or update KYC record
        const finalReferenceId = referenceId || userId;

        if (existingRecord) {
            await this.kycRepository.updateStatus(userId, 'STARTED', {
                personaInquiryId: inquiryId,
                referenceId: finalReferenceId,
                startedAt: new Date().toISOString(),
            });
        } else {
            await this.kycRepository.create({
                userId,
                personaInquiryId: inquiryId,
                referenceId: finalReferenceId,
                status: 'STARTED',
                metadata: {
                    startedAt: new Date().toISOString(),
                },
            });
        }

        // Emit kyc.started event
        await this.emitKycEvent('compliance.kyc.started', userId, {
            userId,
            inquiryId,
            at: new Date().toISOString(),
        });

        this.logger.log(`KYC started for user ${userId}, inquiry: ${inquiryId}`);

        return {
            success: true,
            status: KycStatus.STARTED,
            personaInquiryId: inquiryId,
            verificationUrl,
        };
    }

    /**
     * Get KYC status for a user
     */
    async getStatus(userId: string): Promise<KycStatusResponseDto> {
        const record = await this.kycRepository.findByUserId(userId);

        if (!record) {
            return {
                status: KycStatus.NOT_STARTED,
                createdAt: new Date().toISOString(),
            };
        }

        return {
            status: record.status as KycStatus,
            personaInquiryId: record.personaInquiryId || undefined,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }

    /**
     * Handle webhook from Persona
     */
    async handleWebhook(
        rawPayload: any,
        signature: string,
        payload: PersonaWebhookPayload,
    ): Promise<{ success: boolean; message: string }> {
        // Verify signature
        if (!this.personaService.verifyWebhookSignature(rawPayload, signature)) {
            this.logger.warn('Webhook signature verification failed');
            throw new BadRequestException('Invalid webhook signature');
        }

        // Parse webhook payload
        const { eventId, eventType, inquiryId, status, referenceId, riskSignals } =
            this.personaService.parseWebhookPayload(payload);

        // Idempotency check
        const alreadyProcessed = await this.webhookRepository.exists(eventId);
        if (alreadyProcessed) {
            this.logger.log(`Webhook event ${eventId} already processed, skipping`);
            return { success: true, message: 'Event already processed' };
        }

        // Find KYC record by inquiry ID
        const kycRecord = await this.kycRepository.findByPersonaInquiryId(inquiryId);
        if (!kycRecord) {
            this.logger.warn(`No KYC record found for inquiry ${inquiryId}`);
            // Record the event anyway for debugging
            await this.webhookRepository.create({
                eventId,
                eventType,
                inquiryId,
                payload: payload as any,
            });
            return { success: false, message: 'KYC record not found' };
        }

        const userId = kycRecord.userId;
        const kycStatus = this.personaService.mapStatusToKycStatus(status);

        // Update KYC record
        await this.kycRepository.updateByInquiryId(inquiryId, {
            status: kycStatus,
            metadata: {
                ...((kycRecord.metadata as any) || {}),
                lastWebhookAt: new Date().toISOString(),
                personaStatus: status,
                eventType,
            },
        });

        // Handle risk signals
        if (riskSignals.length > 0) {
            this.logger.log(
                `📍 Processing ${riskSignals.length} risk signal(s) for user ${userId}`,
            );
            for (const risk of riskSignals) {
                await this.kycRepository.createRisk({
                    userId,
                    kycRecordId: kycRecord.id,
                    riskType: risk.type,
                    severity: risk.severity,
                    details: { description: risk.description },
                });
                this.logger.debug(
                    `  ├─ Stored risk: ${risk.type} [${risk.severity.toUpperCase()}]`,
                );
            }
            this.logger.log(`✅ Successfully stored all ${riskSignals.length} risk signal(s)`);
        } else {
            this.logger.debug(`No risk signals detected for user ${userId}`);
        }

        // Handle status-specific logic
        if (kycStatus === 'APPROVED') {
            // Create limits based on risk
            const hasRisk = riskSignals.length > 0;
            const escrowLimit = hasRisk
                ? DEFAULT_ESCROW_LIMIT * REDUCED_LIMIT_FACTOR
                : DEFAULT_ESCROW_LIMIT;
            const ledgerLimit = hasRisk
                ? DEFAULT_LEDGER_LIMIT * REDUCED_LIMIT_FACTOR
                : DEFAULT_LEDGER_LIMIT;

            await this.kycRepository.upsertLimits({
                userId,
                kycRecordId: kycRecord.id,
                escrowLimit,
                ledgerLimit,
            });

            // Emit approved event
            await this.emitKycEvent('compliance.kyc.approved', userId, {
                userId,
                inquiryId,
                at: new Date().toISOString(),
            });

            // Emit limits updated event
            await this.emitKycEvent('compliance.limits.updated', userId, {
                userId,
                escrowLimit,
                ledgerLimit,
                at: new Date().toISOString(),
            });

            this.logger.log(`KYC approved for user ${userId}, limits set`);
        } else if (kycStatus === 'REJECTED') {
            await this.emitKycEvent('compliance.kyc.rejected', userId, {
                userId,
                inquiryId,
                reason: 'Verification declined by Persona',
                at: new Date().toISOString(),
            });
            this.logger.log(`KYC rejected for user ${userId}`);
        } else if (kycStatus === 'REVIEW_REQUIRED') {
            await this.emitKycEvent('compliance.kyc.review_required', userId, {
                userId,
                inquiryId,
                riskFlags: riskSignals,
                at: new Date().toISOString(),
            });
            this.logger.log(`KYC review required for user ${userId}`);
        }

        // Record webhook event for idempotency
        await this.webhookRepository.create({
            eventId,
            eventType,
            inquiryId,
            payload: payload as any,
        });

        return { success: true, message: `KYC status updated to ${kycStatus}` };
    }

    /**
     * Emit KYC event to outbox
     */
    private async emitKycEvent(
        topic: string,
        partitionKey: string,
        payload: any,
    ): Promise<void> {
        try {
            await this.outboxRepository.save(topic, partitionKey, payload);
            this.logger.debug(`Saved ${topic} to outbox for ${partitionKey}`);
        } catch (error) {
            this.logger.error(`Failed to save ${topic} to outbox`, error);
        }
    }
}
