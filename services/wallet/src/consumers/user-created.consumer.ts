import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  KafkaConsumer,
  AuthTopics,
  UserCreatedPayload,
  BaseEvent,
} from '@escrowly/kafka-core';
import { PrismaService } from '../prisma';
import { WalletGeneratorService, GeneratedWallet } from '../crypto';
import { WalletEventProducer } from '../kafka';

/**
 * User Created Consumer
 *
 * Consumes auth.user.created events from Kafka.
 * For each new user, generates custodial wallets for all supported chains.
 *
 * Flow:
 * 1. Receive auth.user.created event
 * 2. Check idempotency (processed_events table)
 * 3. Generate 3 wallets (EVM, SOL, TRC)
 * 4. Encrypt private keys
 * 5. Insert into user_wallets
 * 6. Emit wallet.wallet.created via outbox
 */
@Injectable()
export class UserCreatedConsumer implements OnModuleInit {
  private readonly logger = new Logger(UserCreatedConsumer.name);

  constructor(
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly prisma: PrismaService,
    private readonly walletGenerator: WalletGeneratorService,
    private readonly walletEventProducer: WalletEventProducer,
  ) {}

  async onModuleInit() {
    // Subscribe to auth.user.created topic
    this.kafkaConsumer.subscribe<UserCreatedPayload>(
      AuthTopics.USER_CREATED,
      this.handleUserCreated.bind(this),
    );

    this.logger.log('✅ Subscribed to auth.user.created topic');
  }

  /**
   * Handle user created event
   */
  private async handleUserCreated(event: BaseEvent<UserCreatedPayload>): Promise<void> {
    const { metadata, payload } = event;
    const { eventId } = metadata;
    const { userId, email } = payload;

    this.logger.log(`Processing user.created for ${userId} (${email})`);

    try {
      // Check idempotency - has this event already been processed?
      const existing = await this.prisma.processedEvent.findUnique({
        where: { eventId },
      });

      if (existing) {
        this.logger.debug(`Event ${eventId} already processed, skipping`);
        return;
      }

      // Check if user already has wallets (double-check)
      const existingWallets = await this.prisma.userWallet.findFirst({
        where: { userId },
      });

      if (existingWallets) {
        // Mark event as processed and return
        await this.prisma.processedEvent.create({
          data: {
            eventId,
            eventType: AuthTopics.USER_CREATED,
          },
        });
        this.logger.debug(`User ${userId} already has wallets, skipping`);
        return;
      }

      // Generate wallets for all chains
      const wallets = await this.walletGenerator.generateAllWallets();

      // Use transaction to ensure atomicity
      await this.prisma.$transaction(async (tx) => {
        // Insert all wallets
        for (const wallet of wallets) {
          await tx.userWallet.create({
            data: {
              userId,
              chain: wallet.chain,
              depositAddress: wallet.address,
              encryptedPrivateKey: wallet.encryptedPrivateKey,
              publicKey: wallet.publicKey,
            },
          });
        }

        // Mark event as processed
        await tx.processedEvent.create({
          data: {
            eventId,
            eventType: AuthTopics.USER_CREATED,
          },
        });
      });

      this.logger.log(`Created ${wallets.length} wallets for user ${userId}`);

      // Emit wallet.wallet.created event
      await this.walletEventProducer.walletCreated(
        userId,
        wallets.map((w) => ({
          chain: w.chain,
          depositAddress: w.address,
        })),
        metadata.correlationId,
      );

      this.logger.log(`Emitted wallet.created event for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to process user.created for ${userId}: ${error.message}`);
      throw error; // Re-throw to trigger Kafka retry
    }
  }
}

