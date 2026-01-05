import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Audit Module
 * 
 * Provides audit logging capabilities across the Compliance Service.
 * Global module for easy access from any other module.
 */
@Global()
@Module({
    providers: [AuditService],
    exports: [AuditService],
})
export class AuditModule { }
