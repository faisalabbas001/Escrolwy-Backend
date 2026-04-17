import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycRepository } from './kyc.repository';
import { WebhookRepository } from './webhook.repository';
import { OutboxRepository } from './outbox.repository';
import { KycStateMachine } from './kyc-state-machine';
import { KycRateLimitGuard } from './guards';
import { PersonaModule } from '../persona';

/**
 * KYC Module
 *
 * Handles KYC lifecycle management:
 * - Start KYC process
 * - Handle Persona webhooks
 * - Track KYC status
 * - Enforce state transitions
 */
@Module({
    imports: [PersonaModule],
    controllers: [KycController],
    providers: [
        KycService,
        KycRepository,
        WebhookRepository,
        OutboxRepository,
        KycStateMachine,
        KycRateLimitGuard,
    ],
    exports: [KycService, KycRepository, OutboxRepository, KycStateMachine],
})
export class KycModule { }
