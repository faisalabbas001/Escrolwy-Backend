import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

/**
 * Exports Module
 *
 * Module for data exports to S3/Data Lake.
 */
@Module({
    controllers: [ExportsController],
    providers: [ExportsService],
    exports: [ExportsService],
})
export class ExportsModule { }
