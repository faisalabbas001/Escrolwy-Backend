import { Injectable } from '@nestjs/common';
import { OutboxProcessorService } from './outbox-processor.service';

/**
 * Publisher Service
 *
 * High-level service wrapper around OutboxProcessor.
 * Provides a clean API for triggering immediate processing.
 */
@Injectable()
export class PublisherService {
  constructor(private readonly processor: OutboxProcessorService) {}

  /**
   * Trigger immediate processing of pending events.
   * Useful when you know new events have been added and want
   * to process them immediately instead of waiting for the next poll.
   */
  async triggerProcessing(): Promise<void> {
    await this.processor.trigger();
  }
}

