import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

/**
 * Outbox Repository
 *
 * Handles transactional outbox pattern for Kafka events.
 */
@Injectable()
export class OutboxRepository {
    private readonly logger = new Logger(OutboxRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Save event to outbox for later publishing
     */
    async save<T>(
        topic: string,
        partitionKey: string,
        payload: T,
        eventId?: string,
        status?: string,
    ) {
        return this.prisma.outboxEvent.create({
            data: {
                id: eventId,
                topic,
                partitionKey,
                payload: JSON.stringify(payload),
                status: status || 'pending',
            },
        });
    }

    /**
     * Find pending events for processing
     */
    async findPending(limit: number = 20) {
        return this.prisma.outboxEvent.findMany({
            where: {
                OR: [
                    { status: 'pending' },
                    {
                        status: 'failed',
                        retryCount: { lt: 5 },
                        OR: [
                            { nextRetryAt: null },
                            { nextRetryAt: { lte: new Date() } },
                        ],
                    },
                ],
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    }

    /**
     * Mark event as published
     */
    async markPublished(id: string) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                status: 'published',
                publishedAt: new Date(),
                lastError: null,
                nextRetryAt: null,
            },
        });
    }

    /**
     * Mark event as failed with retry
     */
    async markFailed(id: string, error: string, retryCount: number, nextRetryAt: Date) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                status: 'failed',
                retryCount,
                lastError: error,
                nextRetryAt,
            },
        });
    }
}
