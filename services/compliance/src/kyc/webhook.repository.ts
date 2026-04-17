import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * Webhook Repository
 *
 * Handles webhook event tracking for idempotency.
 */
@Injectable()
export class WebhookRepository {
    private readonly logger = new Logger(WebhookRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Check if webhook event has already been processed
     */
    async exists(eventId: string): Promise<boolean> {
        const event = await this.prisma.webhookEvent.findUnique({
            where: { eventId },
            select: { id: true },
        });
        return !!event;
    }

    /**
     * Record a processed webhook event
     */
    async create(data: {
        eventId: string;
        eventType: string;
        inquiryId: string;
        payload?: any;
    }) {
        return this.prisma.webhookEvent.create({
            data: {
                eventId: data.eventId,
                eventType: data.eventType,
                inquiryId: data.inquiryId,
                payload: data.payload,
            },
        });
    }
}
