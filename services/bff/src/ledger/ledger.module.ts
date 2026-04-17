import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';

/**
 * Ledger Module (BFF)
 * 
 * Groups all routes that proxy to Ledger service:
 * - /api/v1/ledger/* (user endpoints)
 * 
 * Note: Internal-only endpoints (balance-check, reservations) are NOT exposed
 * through BFF as they require service-to-service authentication.
 */
@Module({
  controllers: [LedgerController],
})
export class LedgerModule {}

