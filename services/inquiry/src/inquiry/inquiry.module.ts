import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InquiryController } from './inquiry.controller';
import { AdminInquiryController } from './admin-inquiry.controller';
import { InquiryService } from './inquiry.service';
import { InquiryConsumerService } from './inquiry-consumer.service';
import { InquiryGateway } from './inquiry.gateway';
import { OutboxRepository } from './repository';
import { InquiryEventProducer } from '../kafka';
import { PrismaModule } from '../prisma';
import { UploadModule } from '../upload';

/**
 * Inquiry Module
 *
 * Provides inquiry management functionality:
 * - Create and manage inquiries
 * - Message handling
 * - Attachment management
 * - Admin operations
 * - Real-time WebSocket communication
 * - Kafka event publishing via outbox pattern
 * - Event consumption from other services
 *
 * Uses @escrowly/kafka-core and @escrowly/kafka-publisher for
 * production-ready Kafka integration with Transactional Outbox Pattern.
 *
 * Uses Socket.IO WebSocket gateway for real-time chat communication.
 */
@Module({
  imports: [PrismaModule, UploadModule, HttpModule],
  controllers: [InquiryController, AdminInquiryController],
  providers: [
    InquiryService,
    InquiryGateway,
    InquiryConsumerService,
    OutboxRepository,
    InquiryEventProducer,
  ],
  exports: [InquiryService, InquiryGateway, InquiryEventProducer],
})
export class InquiryModule {}
