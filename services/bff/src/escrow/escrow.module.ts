import { Module } from '@nestjs/common';
import { EscrowController } from './escrow.controller';
import { AdminEscrowController } from './admin-escrow.controller';

/**
 * Escrow Module (BFF)
 * 
 * Groups all routes that proxy to Escrow service:
 * - /api/v1/escrows/* (user endpoints)
 * - /api/v1/admin/escrows/* (admin endpoints)
 */
@Module({
  controllers: [EscrowController, AdminEscrowController],
})
export class EscrowModule {}

