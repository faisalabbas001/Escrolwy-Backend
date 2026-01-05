import { Injectable, Logger } from '@nestjs/common';
import { OutboxRepository } from './repository';

/**
 * Reporting Event Producer
 *
 * Produces Kafka events for reporting alerts using the Transactional Outbox Pattern.
 * Events are written to the outbox table and published to Kafka by OutboxProcessorService.
 * All methods are fire-and-forget - failures are logged but don't block.
 *
 * Matches Auth Service pattern for consistency.
 */
@Injectable()
export class ReportingEventProducer {
    private readonly logger = new Logger(ReportingEventProducer.name);

    constructor(private readonly outboxRepository: OutboxRepository) { }

    /**
     * Publish alert.triggered event
     */
    async alertTriggered(
        alertId: string,
        alertType: string,
        source: string,
        severity: string,
        description: string,
    ): Promise<void> {
        const payload = {
            alertId,
            alertType,
            source,
            severity,
            description,
            triggeredAt: new Date().toISOString(),
        };

        try {
            await this.outboxRepository.save(
                'reporting.alert.triggered',
                alertId,
                payload,
            );

            this.logger.debug(`Alert triggered event saved to outbox: ${alertId}`);
        } catch (error: any) {
            this.logger.error(
                `Failed to save alert.triggered event to outbox: ${error.message}`,
            );
        }
    }
}
