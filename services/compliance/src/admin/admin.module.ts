import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Admin Module
 *
 * Provides admin endpoints for compliance management:
 * - Review flagged users
 * - Approve/reject KYC
 * - Adjust limits
 * - Reset KYC
 */
@Module({
    controllers: [AdminController],
    providers: [AdminService],
    exports: [AdminService],
})
export class AdminModule { }
