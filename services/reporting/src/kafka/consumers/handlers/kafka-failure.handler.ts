import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IEventHandler } from './event-handler.interface';
import { BaseEvent } from '@escrowly/kafka-core';

@Injectable()
export class KafkaFailureHandler implements IEventHandler {
    private readonly logger = new Logger(KafkaFailureHandler.name);

    constructor(private readonly prisma: PrismaService) { }

    async handle(event: BaseEvent<any>): Promise<void> {
        // Failed events often have a slightly different structure or wrapper
        // We attempt to extract meaningful info, but fallback to raw storage

        const topic = (event.metadata as any)?.type || 'unknown.failure';
        const source = event.metadata?.source || 'unknown';
        const eventId = event.metadata?.eventId;

        // In a real failure scenario from kafka-core, the payload might contain the error
        // For compliance.failure, it's typically { originalEvent, error }

        const payload = (event as any).data || (event as any).payload;
        const error = (payload as any)?.error?.message || (payload as any)?.error || 'Unknown Kafka Failure';

        this.logger.warn(`Persisting Kafka Failure: ${topic} from ${source}`);

        try {
            await this.prisma.kafkaFailure.create({
                data: {
                    topic: topic,
                    payload: payload as any, // Cast to JSON
                    error: JSON.stringify(error),
                    sourceService: source,
                    status: 'FAILED',
                    offset: '0', // Not easily accessible here without context, strictly payload based
                },
            });
        } catch (dbError) {
            this.logger.error(`Failed to persist Kafka Failure to DB!`, dbError);
        }
    }
}
