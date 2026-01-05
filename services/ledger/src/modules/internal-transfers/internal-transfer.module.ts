import { Module } from '@nestjs/common';
import { InternalTransferController } from './internal-transfer.controller';
import { InternalTransferService } from './internal-transfer.service';
import { TransferModule } from '../transfers/transfer.module';

/**
 * Internal Transfer Module
 *
 * Manages internal transfers between users (user-to-user within Escrowly)
 * Follows SOLID principles and flat code practices
 */
@Module({
  imports: [TransferModule],
  controllers: [InternalTransferController],
  providers: [InternalTransferService],
  exports: [InternalTransferService],
})
export class InternalTransferModule {}

