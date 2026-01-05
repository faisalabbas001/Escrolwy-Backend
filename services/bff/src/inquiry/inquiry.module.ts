import { Module } from '@nestjs/common';
import { InquiryController } from './inquiry.controller';
import { AdminInquiryController } from './admin-inquiry.controller';

/**
 * Inquiry Module (BFF)
 * 
 * Groups all routes that proxy to Inquiry service:
 * - /api/v1/inquiries/* (user endpoints)
 * - /api/v1/admin/inquiries/* (admin endpoints)
 * 
 * Note: WebSocket connections (real-time messaging) connect directly from
 * frontend to Inquiry Service - BFF does NOT proxy WebSockets.
 */
@Module({
  controllers: [InquiryController, AdminInquiryController],
})
export class InquiryModule {}

