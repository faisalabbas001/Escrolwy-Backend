import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import {
    PersonaInquiryResponse,
    PersonaWebhookPayload,
    PersonaConfig,
    PersonaRiskSignal,
} from './persona.types';

/**
 * Persona Service
 *
 * Handles all interactions with the Persona KYC API.
 * - Create inquiries
 * - Verify webhook signatures
 * - Parse webhook payloads
 */
@Injectable()
export class PersonaService {
    private readonly logger = new Logger(PersonaService.name);
    private readonly client: AxiosInstance;
    private readonly config: PersonaConfig;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('PERSONA_API_KEY', '');
        const templateId = this.configService.get<string>('PERSONA_TEMPLATE_ID', '');
        const webhookSecret = this.configService.get<string>('PERSONA_WEBHOOK_SECRET', '');
        const environment = this.configService.get<string>('PERSONA_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production';

        this.config = {
            apiKey,
            templateId,
            webhookSecret,
            environment,
            baseUrl: 'https://withpersona.com/api/v1',
        };

        this.client = axios.create({
            baseURL: this.config.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'Persona-Version': '2023-01-05',
            },
        });

        this.logger.log(`Persona service initialized (${environment} mode)`);
    }

    /**
     * Create a new Persona inquiry for a user
     */
    async createInquiry(userId: string, referenceId?: string): Promise<{
        inquiryId: string;
        verificationUrl: string;
        sessionToken?: string;
    }> {
        // MOCK: If using placeholder API key, return mock response
        // if (this.config.apiKey.startsWith('persona_sandbox_xxxx')) {
        //     this.logger.warn('USING MOCK PERSONA RESPONSE (Placeholder API Key detected)');
        //     const mockInquiryId = `inq_mock_${Date.now()}`;
        //     return {
        //         inquiryId: mockInquiryId,
        //         verificationUrl: `https://withpersona.com/verify?inquiry-id=${mockInquiryId}`,
        //         sessionToken: `tok_mock_${Date.now()}`,
        //     };
        // }

        try {
            const response = await this.client.post<PersonaInquiryResponse>('/inquiries', {
                data: {
                    attributes: {
                        'inquiry-template-id': this.config.templateId,
                        'reference-id': referenceId || userId,
                    },
                },
            });


            const inquiryId = response.data.data.id;
            const sessionToken = response.data.meta?.['session-token'];

            // Construct verification URL
            const verificationUrl = `https://withpersona.com/verify?inquiry-id=${inquiryId}${sessionToken ? `&session-token=${sessionToken}` : ''
                }`;

            this.logger.log(`Created Persona inquiry ${inquiryId} for user ${userId}`);

            return {
                inquiryId,
                verificationUrl,
                sessionToken,
            };
        } catch (error) {
            this.logger.error(`Failed to create Persona inquiry for user ${userId}`, error);

            // MOCK: Fallback for development if API fails (e.g. invalid key format but not placeholder)
            if (this.config.environment === 'sandbox') {
                this.logger.warn('USING MOCK PERSONA RESPONSE (API call failed in sandbox)');
                const mockInquiryId = `inq_mock_fallback_${Date.now()}`;
                return {
                    inquiryId: mockInquiryId,
                    verificationUrl: `https://withpersona.com/verify?inquiry-id=${mockInquiryId}`,
                    sessionToken: `tok_mock_fallback_${Date.now()}`,
                };
            }

            throw error;
        }
    }

    /**
     * Verify webhook signature from Persona
     * Uses HMAC-SHA256 to verify the request authenticity
     * 
     * Persona signature format: t=timestamp,v1=signature
     */
    verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): boolean {
        if (!this.config.webhookSecret) {
            this.logger.warn('⚠️ WEBHOOK SIGNATURE VERIFICATION BYPASSED');
            return true;
        }

        if (!signatureHeader) {
            this.logger.warn('❌ Missing Persona-Signature header');
            return false;
        }

        try {
            const parts = signatureHeader.split(',');
            const timestampPart = parts.find(p => p.startsWith('t='));
            const signaturePart = parts.find(p => p.startsWith('v1='));

            if (!timestampPart || !signaturePart) {
                this.logger.warn('❌ Invalid Persona signature format');
                return false;
            }

            const timestamp = Number(timestampPart.slice(2));
            const receivedSignature = signaturePart.slice(3);

            // Replay protection
            const age = Math.abs(Date.now() / 1000 - timestamp);
            if (age > 300) {
                this.logger.warn(`❌ Webhook timestamp too old: ${age}s`);
                return false;
            }

            // Compute expected signature
            // Persona signs "timestamp.body" (standard pattern used by Stripe, etc.)
            const signedPayload = `${timestamp}.${rawBody.toString()}`;
            const expectedSignature = crypto
                .createHmac('sha256', this.config.webhookSecret)
                .update(signedPayload)
                .digest('hex');

            const receivedBuffer = Buffer.from(receivedSignature, 'hex');
            const expectedBuffer = Buffer.from(expectedSignature, 'hex');

            // 🔐 CRITICAL FIX
            if (receivedBuffer.length !== expectedBuffer.length) {
                this.logger.warn(
                    `❌ Signature length mismatch: received=${receivedBuffer.length}, expected=${expectedBuffer.length}`,
                );
                return false;
            }

            const isValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

            if (!isValid) {
                this.logger.warn(
                    `❌ Signature mismatch | Timestamp: ${timestamp} | Received: ${receivedSignature.substring(0, 16)}... | Expected: ${expectedSignature.substring(0, 16)}...`,
                );
            } else {
                this.logger.log(`✅ Webhook signature verified (timestamp: ${timestamp})`);
            }

            return isValid;
        } catch (err: any) {
            this.logger.error(`❌ Signature verification error: ${err.message}`);
            return false;
        }
    }



    /**
     * Parse webhook payload and extract relevant data
     */
    parseWebhookPayload(payload: PersonaWebhookPayload): {
        eventId: string;
        eventType: string;
        inquiryId: string;
        status: string;
        referenceId: string | null;
        riskSignals: PersonaRiskSignal[];
    } {
        const eventId = payload.data.id;
        const eventType = payload.data.attributes.name;
        const inquiryData = payload.data.attributes.payload.data;
        const inquiryId = inquiryData.id;
        const status = inquiryData.attributes.status;
        const referenceId = inquiryData.attributes['reference-id'];

        // Extract risk signals from multiple sources in Persona webhook
        const riskSignals: PersonaRiskSignal[] = [];
        const included = payload.data.attributes.payload.included || [];

        // 1️⃣ Extract risk tags from main inquiry data
        // Persona adds tags like 'risk_*', 'fraud_*', 'suspicious_*' when concerns are detected
        const inquiryTags = inquiryData.attributes.tags || [];
        for (const tag of inquiryTags) {
            const tagLower = tag.toLowerCase();
            if (
                tagLower.includes('risk') ||
                tagLower.includes('fraud') ||
                tagLower.includes('suspicious') ||
                tagLower.includes('flag') ||
                tagLower.includes('warning')
            ) {
                // Determine severity based on tag content
                let severity: 'low' | 'medium' | 'high' = 'medium';
                if (tagLower.includes('high') || tagLower.includes('critical') || tagLower.includes('fraud')) {
                    severity = 'high';
                } else if (tagLower.includes('low') || tagLower.includes('minor')) {
                    severity = 'low';
                }

                riskSignals.push({
                    type: 'risk_tag',
                    severity,
                    description: `Risk tag detected: ${tag}`,
                });
            }
        }

        // 2️⃣ Extract verification check failures (existing logic - enhanced)
        for (const item of included) {
            if (item.type === 'verification' && item.attributes?.checks) {
                // Look for failed checks that indicate risk
                for (const [checkName, checkResult] of Object.entries(item.attributes.checks)) {
                    if (checkResult === 'failed' || checkResult === 'not_applicable') {
                        riskSignals.push({
                            type: `verification_${checkName}`,
                            severity: 'medium',
                            description: `Verification check failed: ${checkName} (${checkResult})`,
                        });
                    }
                }
            }

            // 3️⃣ Extract report-level risk flags
            // Reports (document, selfie, etc.) may have their own tags indicating issues
            if (item.type && item.type.includes('report')) {
                const reportTags = item.attributes?.tags || [];
                for (const tag of reportTags) {
                    const tagLower = tag.toLowerCase();
                    if (
                        tagLower.includes('risk') ||
                        tagLower.includes('quality') ||
                        tagLower.includes('tamper') ||
                        tagLower.includes('fake') ||
                        tagLower.includes('mismatch')
                    ) {
                        let severity: 'low' | 'medium' | 'high' = 'medium';
                        if (tagLower.includes('high') || tagLower.includes('tamper') || tagLower.includes('fake')) {
                            severity = 'high';
                        } else if (tagLower.includes('low') || tagLower.includes('quality')) {
                            severity = 'low';
                        }

                        riskSignals.push({
                            type: `${item.type}_tag`,
                            severity,
                            description: `Report flag: ${tag} (${item.type})`,
                        });
                    }
                }
            }
        }

        // Log extraction summary
        if (riskSignals.length > 0) {
            this.logger.log(
                `🔍 Extracted ${riskSignals.length} risk signal(s) from Persona webhook for inquiry ${inquiryId}`,
            );
            riskSignals.forEach((signal, idx) => {
                this.logger.debug(`  ${idx + 1}. [${signal.severity.toUpperCase()}] ${signal.type}: ${signal.description}`);
            });
        } else {
            this.logger.debug(`No risk signals detected in webhook for inquiry ${inquiryId}`);
        }

        return {
            eventId,
            eventType,
            inquiryId,
            status,
            referenceId,
            riskSignals,
        };
    }

    /**
     * Map Persona status to internal KYC status
     */
    mapStatusToKycStatus(personaStatus: string): string {
        switch (personaStatus) {
            case 'approved':
                return 'APPROVED';
            case 'declined':
                return 'REJECTED';
            case 'needs_review':
            case 'marked-for-review':
                return 'REVIEW_REQUIRED';
            case 'created':
            case 'pending':
                return 'STARTED';
            case 'completed':
                return 'STARTED'; // Still needs determination
            default:
                return 'STARTED';
        }
    }
}
