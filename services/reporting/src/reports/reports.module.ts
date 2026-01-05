import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Reports Module
 *
 * READ-ONLY module for escrow, transaction, user, and wallet reports.
 */
@Module({
    controllers: [ReportsController],
    providers: [ReportsService],
    exports: [ReportsService],
})
export class ReportsModule { }
