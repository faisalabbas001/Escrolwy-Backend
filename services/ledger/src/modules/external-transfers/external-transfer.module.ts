import { Module } from '@nestjs/common';
import { ExternalTransferController } from './external-transfer.controller';
import { ExternalTransferService } from './external-transfer.service';
import { TransferModule } from '../transfers/transfer.module';

/**
 * External Transfer Module
 *
 * Manages external transfers (user to external blockchain addresses)
 * Uses the main Transfer table with type='external' - no separate table needed
 * Follows SOLID principles and flat code practices
 */
@Module({
  imports: [TransferModule],
  controllers: [ExternalTransferController],
  providers: [ExternalTransferService],
  exports: [ExternalTransferService],
})
export class ExternalTransferModule {}

