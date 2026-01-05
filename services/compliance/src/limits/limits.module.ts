import { Module } from '@nestjs/common';
import { LimitsController } from './limits.controller';
import { LimitsService } from './limits.service';
import { LimitsRepository } from './limits.repository';

/**
 * Limits Module
 *
 * Provides secured API for user limits:
 * - GET /s2s/limits/:userId (JWT required)
 */
@Module({
    controllers: [LimitsController],
    providers: [LimitsService, LimitsRepository],
    exports: [LimitsService, LimitsRepository],
})
export class LimitsModule { }
