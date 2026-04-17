/**
 * Persona Types
 *
 * Type definitions for Persona API interactions.
 */

// Persona API response for creating an inquiry
export interface PersonaInquiryResponse {
    data: {
        id: string;
        type: 'inquiry';
        attributes: {
            status: string;
            'reference-id': string | null;
            'created-at': string;
            'completed-at': string | null;
        };
        relationships?: {
            template?: { data: { id: string; type: string } };
        };
    };
    meta?: {
        'session-token'?: string;
    };
}

// Persona inquiry status values
export type PersonaInquiryStatus =
    | 'created'
    | 'pending'
    | 'completed'
    | 'failed'
    | 'expired'
    | 'approved'
    | 'declined'
    | 'needs_review';

// Persona webhook event types
export type PersonaWebhookEventType =
    | 'inquiry.created'
    | 'inquiry.pending'
    | 'inquiry.completed'
    | 'inquiry.approved'
    | 'inquiry.declined'
    | 'inquiry.marked-for-review'
    | 'inquiry.expired';

// Persona webhook payload structure
export interface PersonaWebhookPayload {
    data: {
        id: string; // Event ID
        type: string;
        attributes: {
            name: PersonaWebhookEventType;
            payload: {
                data: {
                    id: string; // Inquiry ID
                    type: 'inquiry';
                    attributes: {
                        status: PersonaInquiryStatus;
                        'reference-id': string | null;
                        'created-at': string;
                        'completed-at': string | null;
                        'redacted-at': string | null;
                        'session-token': string | null;
                        'previous-step-name': string | null;
                        'current-step-name': string | null;
                        'next-step-name': string | null;
                        tags?: string[];
                    };
                    relationships?: {
                        account?: { data: { id: string; type: string } | null };
                        template?: { data: { id: string; type: string } };
                        verifications?: { data: Array<{ id: string; type: string }> };
                    };
                };
                included?: Array<{
                    id: string;
                    type: string;
                    attributes: Record<string, any>;
                }>;
            };
            'created-at': string;
        };
    };
}

// Risk signals from Persona
export interface PersonaRiskSignal {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description?: string;
}

// Configuration for Persona service
export interface PersonaConfig {
    apiKey: string;
    templateId: string;
    webhookSecret: string;
    environment: 'sandbox' | 'production';
    baseUrl: string;
}
