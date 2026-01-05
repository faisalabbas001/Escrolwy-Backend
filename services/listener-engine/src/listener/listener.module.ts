import { Module } from '@nestjs/common';
import { ListenerService } from './listener.service';

/**
 * Listener Module
 *
 * Provides the blockchain listener service.
 * The ListenerService automatically starts on module init
 * and stops on module destroy.
 */
@Module({
  providers: [ListenerService],
  exports: [ListenerService],
})
export class ListenerModule {}

