import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EscrowRepository, EscrowTransitionRepository, EscrowReminderRepository } from '../repository';
import { EscrowEventProducer } from '../../../kafka';
import { EscrowEntity } from '../entities/escrow.entity';

/**
 * Escrow Reminder Cron Service
 *
 * State-based cron jobs that send reminder notifications based on
 * escrow state and elapsed time since last state transition.
 *
 * These cron jobs DO NOT change state - they only produce events for reminders/notifications.
 */
@Injectable()
export class EscrowReminderCronService {
  private readonly logger = new Logger(EscrowReminderCronService.name);

  // SLA thresholds in hours (configurable via environment variables)
  private readonly slaThresholds = {
    agreement: parseInt(
      this.configService.get<string>('ESCROW_REMINDER_CREATED_HOURS', '24'),
      10,
    ),
    accepted: parseInt(
      this.configService.get<string>('ESCROW_REMINDER_ACCEPTED_HOURS', '24'),
      10,
    ),
    funded: parseInt(
      this.configService.get<string>('ESCROW_REMINDER_FUNDED_HOURS', '48'),
      10,
    ),
    delivery: parseInt(
      this.configService.get<string>('ESCROW_REMINDER_DELIVERED_HOURS', '72'),
      10,
    ),
    inspection: parseInt(
      this.configService.get<string>('ESCROW_REMINDER_INSPECTION_HOURS', '48'),
      10,
    ),
    disputed: parseInt(
      this.configService.get<string>('ESCROW_REMINDER_DISPUTED_HOURS', '24'),
      10,
    ),
  };

  // Minimum time between reminders (in hours) to prevent spam
  private readonly reminderIntervalHours = parseInt(
    this.configService.get<string>('ESCROW_REMINDER_INTERVAL_HOURS', '24'),
    10,
  );

  // Admin user ID for dispute reminders
  private readonly adminUserId = this.configService.get<string>(
    'ESCROW_ADMIN_USER_ID',
    '00000000-0000-0000-0000-000000000000',
  );

  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly transitionRepository: EscrowTransitionRepository,
    private readonly reminderRepository: EscrowReminderRepository,
    private readonly eventProducer: EscrowEventProducer,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Main cron job - runs every 30 minutes
   * Processes all escrow states that need reminders
   */
  @Cron('*/30 * * * *')
  async processReminders(): Promise<void> {
    this.logger.log('Starting escrow reminder cron job');

    try {
      // Process each state that needs reminders
      await this.processStateReminders('agreement', 'accept');
      await this.processStateReminders('accepted', 'fund');
      await this.processStateReminders('funded', 'deliver');
      await this.processStateReminders('delivery', 'inspect');
      await this.processStateReminders('inspection', 'complete');
      await this.processStateReminders('disputed', 'dispute');

      this.logger.log('Completed escrow reminder cron job');
    } catch (error: any) {
      this.logger.error(
        `Error in escrow reminder cron job: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process reminders for a specific state
   */
  private async processStateReminders(
    state: string,
    reminderType: string,
  ): Promise<void> {
    try {
      // Get all escrows in this state
      const escrows = await this.escrowRepository.findByState(state);

      this.logger.debug(
        `Processing ${escrows.length} escrows in state: ${state}`,
      );

      for (const escrow of escrows) {
        await this.processEscrowReminder(escrow, state, reminderType);
      }
    } catch (error: any) {
      this.logger.error(
        `Error processing reminders for state ${state}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process reminder for a single escrow
   */
  private async processEscrowReminder(
    escrow: EscrowEntity,
    state: string,
    reminderType: string,
  ): Promise<void> {
    try {
      // Get latest transition to current state
      const transition = await this.transitionRepository.findLatestTransitionToState(
        escrow.id,
        state,
      );

      if (!transition) {
        this.logger.warn(
          `No transition found for escrow ${escrow.id} to state ${state}`,
        );
        return;
      }

      // Calculate elapsed time in hours
      const now = new Date();
      const transitionTime = transition.createdAt;
      const elapsedMs = now.getTime() - transitionTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      // Check if SLA threshold is exceeded
      const threshold = this.slaThresholds[state as keyof typeof this.slaThresholds];
      if (elapsedHours < threshold) {
        // SLA not exceeded yet
        return;
      }

      // Check if reminder was sent recently (idempotency)
      const recentReminder = await this.reminderRepository.findRecentByEscrowAndType(
        escrow.id,
        reminderType,
        this.reminderIntervalHours,
      );

      if (recentReminder) {
        // Reminder sent recently, skip
        this.logger.debug(
          `Reminder ${reminderType} already sent recently for escrow ${escrow.id}`,
        );
        return;
      }

      // Determine who to notify based on state and creator
      const notifiedUserIds = this.determineNotifiedUsers(
        escrow,
        state,
        reminderType,
      );

      if (notifiedUserIds.length === 0) {
        this.logger.warn(
          `No users to notify for escrow ${escrow.id} in state ${state}`,
        );
        return;
      }

      // Produce reminder event
      await this.produceReminderEvent(
        escrow,
        state,
        reminderType,
        elapsedHours,
        notifiedUserIds,
      );

      // Track reminder in database
      await this.reminderRepository.createAndMarkAsSent(
        escrow.id,
        reminderType,
        {
          elapsedHours,
          state,
          notifiedUserIds,
        },
      );

      this.logger.log(
        `Reminder ${reminderType} sent for escrow ${escrow.id} (elapsed: ${elapsedHours.toFixed(2)}h)`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error processing reminder for escrow ${escrow.id}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Determine which users should receive the reminder notification
   */
  private determineNotifiedUsers(
    escrow: EscrowEntity,
    state: string,
    reminderType: string,
  ): string[] {
    const notifiedUserIds: string[] = [];

    switch (state) {
      case 'agreement': {
        // CREATED state - notify based on creator
        // If buyer created → notify seller
        // If seller created → notify buyer
        // If broker created → notify both buyer and seller
        const creator = this.determineCreator(
          escrow.createdBy,
          escrow.buyerId,
          escrow.sellerId,
          escrow.brokerId,
        );

        if (creator === 'buyer') {
          notifiedUserIds.push(escrow.sellerId);
        } else if (creator === 'seller') {
          notifiedUserIds.push(escrow.buyerId);
        } else if (creator === 'broker') {
          notifiedUserIds.push(escrow.buyerId, escrow.sellerId);
        }
        break;
      }

      case 'accepted': {
        // ACCEPTED state - remind buyer to fund
        notifiedUserIds.push(escrow.buyerId);
        break;
      }

      case 'funded': {
        // FUNDED state - remind seller to deliver
        notifiedUserIds.push(escrow.sellerId);
        break;
      }

      case 'delivery': {
        // DELIVERED state - remind buyer to inspect
        notifiedUserIds.push(escrow.buyerId);
        break;
      }

      case 'inspection': {
        // INSPECTION state - remind buyer to complete
        notifiedUserIds.push(escrow.buyerId);
        break;
      }

      case 'disputed': {
        // DISPUTED state - remind admin
        notifiedUserIds.push(this.adminUserId);
        break;
      }

      default:
        this.logger.warn(`Unknown state for reminder: ${state}`);
    }

    return notifiedUserIds;
  }

  /**
   * Determine who created the escrow based on userId
   * Returns 'buyer', 'seller', 'broker', or null if userId doesn't match any party
   */
  private determineCreator(
    userId: string,
    buyerId: string,
    sellerId: string,
    brokerId?: string,
  ): 'buyer' | 'seller' | 'broker' | null {
    if (userId === buyerId) {
      return 'buyer';
    }
    if (userId === sellerId) {
      return 'seller';
    }
    if (brokerId && userId === brokerId) {
      return 'broker';
    }
    return null;
  }

  /**
   * Produce the appropriate reminder event based on reminder type
   */
  private async produceReminderEvent(
    escrow: EscrowEntity,
    state: string,
    reminderType: string,
    elapsedHours: number,
    notifiedUserIds: string[],
  ): Promise<void> {
    const commonParams = [
      escrow.id,
      escrow.buyerId,
      escrow.sellerId,
      escrow.brokerId,
      state,
      elapsedHours,
      notifiedUserIds,
    ] as const;

    switch (reminderType) {
      case 'accept':
        await this.eventProducer.reminderAccept(...commonParams);
        break;
      case 'fund':
        await this.eventProducer.reminderFund(...commonParams);
        break;
      case 'deliver':
        await this.eventProducer.reminderDeliver(...commonParams);
        break;
      case 'inspect':
        await this.eventProducer.reminderInspect(...commonParams);
        break;
      case 'complete':
        await this.eventProducer.reminderComplete(...commonParams);
        break;
      case 'dispute':
        await this.eventProducer.reminderDispute(...commonParams);
        break;
      default:
        this.logger.error(`Unknown reminder type: ${reminderType}`);
    }
  }
}

