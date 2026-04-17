import { Module } from '@nestjs/common';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { ReservationRepository } from './repository';
import { ReservationValidator } from './validators';
import { ReservationExecutorService } from './services';
import { DatabaseModule } from '../../common/database/database.module';
import { TransferModule } from '../transfers/transfer.module';

/**
 * Reservation Module
 *
 * Manages fund reservations for escrow operations
 * Follows SOLID principles and flat code practices
 */
@Module({
  imports: [DatabaseModule, TransferModule],
  controllers: [ReservationController],
  providers: [
    ReservationService,
    ReservationRepository,
    ReservationValidator,
    ReservationExecutorService,
  ],
  exports: [ReservationService, ReservationRepository],
})
export class ReservationModule {}

