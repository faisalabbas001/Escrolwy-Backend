import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { EscrowRepository, EscrowTransitionRepository } from './repository';
import {
  CreateEscrowDto,
  UpdateEscrowDto,
  AcceptEscrowDto,
} from './dto/create-escrow.dto';
import { EscrowEntity } from './entities/escrow.entity';
import { calculatePlatformFee } from '../../common/config/platform-fees.config';
import { EscrowEventProducer } from '../../kafka';
import { EscrowSnapshot } from '@escrowly/kafka-core';
import { ILedgerClient, LEDGER_CLIENT_TOKEN } from './services/interfaces/ledger-client.interface';
import { FeeValidatorService } from './validators/fee-validator.service';

/**
 * Escrow Service
 *
 * Business logic for escrow operations.
 * Coordinates between controller, repository, and event publishing.
 *
 * Every state change:
 * 1. Updates the database
 * 2. Logs the transition (immutable audit trail)
 * 3. Publishes a Kafka event (via outbox pattern)
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly transitionRepository: EscrowTransitionRepository,
    private readonly eventProducer: EscrowEventProducer,
    @Inject(LEDGER_CLIENT_TOKEN)
    private readonly ledgerClient: ILedgerClient,
    private readonly feeValidatorService: FeeValidatorService,
  ) {}

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
   * Create a new escrow
   * 
   * @param jwtToken - Optional JWT token to forward to Ledger service for authentication
   */
  async createEscrow(
    createEscrowDto: CreateEscrowDto,
    userId: string,
    jwtToken?: string,
  ): Promise<EscrowEntity> {
    // Determine who created the escrow
    const creator = this.determineCreator(
      userId,
      createEscrowDto.buyerId,
      createEscrowDto.sellerId,
      createEscrowDto.brokerId,
    );

    if (!creator) {
      throw new BadRequestException(
        'User creating escrow must be either buyer, seller, or broker',
      );
    }

    // Calculate platform fees
    const feeInfo = calculatePlatformFee(createEscrowDto.amount);
    const totalAmount = feeInfo.totalAmount;

    // Default feeSplitPercentages to 50/50 if feePaidBy is 'split' but feeSplitPercentages is not provided
    let feeSplitPercentages = createEscrowDto.feeSplitPercentages;
    if (createEscrowDto.feePaidBy === 'split' && !feeSplitPercentages) {
      feeSplitPercentages = { buyer: 50, seller: 50 };
      this.logger.log('feePaidBy is "split" but feeSplitPercentages not provided. Defaulting to 50/50 split.');
    }

    // Validate balances based on creator and fee payment model
    // Broker-created escrows skip creation-time checks (validation happens at acceptance)
    if (creator !== 'broker') {
      // Pass the defaulted feeSplitPercentages to validator
      const dtoWithDefaults = {
        ...createEscrowDto,
        feeSplitPercentages,
      };
      await this.feeValidatorService.validateFeePayment(dtoWithDefaults, creator, jwtToken);
      this.logger.log(
        `Balance validation passed for ${creator}-created escrow. Creator: ${userId}`,
      );
    } else {
      this.logger.log(
        `Broker-created escrow: Skipping creation-time balance checks. Creator: ${userId}`,
      );
    }

    // Create escrow with fees included (with defaulted feeSplitPercentages)
    const escrowData = {
      ...createEscrowDto,
      feeSplitPercentages, // Include defaulted value
      platformFeePercentage: feeInfo.feePercentage,
      platformFeeAmount: feeInfo.feeAmount,
      totalAmount: totalAmount,
    };

    const escrow = await this.escrowRepository.create(escrowData, userId);

    // Log initial state transition with fee info
    await this.transitionRepository.create(
      escrow.id,
      'initial',
      'agreement',
      userId,
      'Escrow created',
      {
        chain: createEscrowDto.chain,
        asset: createEscrowDto.asset,
        baseAmount: createEscrowDto.amount,
        platformFeePercentage: feeInfo.feePercentage,
        platformFeeAmount: feeInfo.feeAmount,
        totalAmount: feeInfo.totalAmount,
      },
    );

    // Publish escrow.created event
    await this.eventProducer.escrowCreated(
      this.toSnapshot(escrow),
      userId,
    );

    this.logger.log(`Escrow created: ${escrow.id}`);
    return escrow;
  }

  /**
   * Get escrow by ID
   */
  async getEscrow(id: string): Promise<EscrowEntity> {
    const escrow = await this.escrowRepository.findById(id);

    if (!escrow) {
      throw new NotFoundException(`Escrow ${id} not found`);
    }

    return escrow;
  }

  /**
   * Get escrows for current user
   */
  async getUserEscrows(userId: string): Promise<EscrowEntity[]> {
    return this.escrowRepository.findByUserId(userId);
  }

  /**
   * Update escrow details
   */
  async updateEscrow(
    id: string,
    updateEscrowDto: UpdateEscrowDto,
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);

    if (escrow.state !== 'agreement') {
      throw new BadRequestException(
        'Can only update escrow details in agreement state',
      );
    }

    return this.escrowRepository.update(id, updateEscrowDto);
  }

  /**
   * Validate balances at acceptance time based on creator, fee payment model, and who is accepting
   */
  private async validateAcceptBalance(
    escrow: EscrowEntity,
    escrowWithFees: {
      escrow: EscrowEntity;
      fees: {
        feeAmount: number;
        feePercentage: number | null;
        paidBy: string;
      } | null;
      feeSplit: {
        feeAmount: number;
        buyerPays: number;
        sellerPays: number;
        brokerPays: number | null;
        buyerPercent: number | null;
        sellerPercent: number | null;
        brokerPercent: number | null;
        paidBy: string;
      } | null;
    },
    acceptingUserId: string,
    jwtToken?: string,
  ): Promise<void> {
    const creator = this.determineCreator(
      escrow.createdBy,
      escrow.buyerId,
      escrow.sellerId,
      escrow.brokerId,
    );

    if (!creator) {
      throw new BadRequestException('Unable to determine escrow creator');
    }

    const escrowAmount = escrow.amount;
    const fees = escrowWithFees.fees;
    const feeSplit = escrowWithFees.feeSplit;
    const feePaidBy = fees?.paidBy || 'buyer';
    const platformFeeTotal = fees?.feeAmount || escrow.platformFee;

    if (creator === 'buyer') {
      // Buyer-Created Escrow Cases
      if (feePaidBy === 'buyer') {
        // Case 1: Buyer pays full fee - No validation needed (already checked at creation)
        this.logger.log('Buyer-created escrow with buyer paying full fee: No acceptance-time validation needed.');
      } else if (feePaidBy === 'split') {
        // Case 2: Half Fee/Split - Validate seller balance >= seller fee portion
        let sellerFeePortion: number;
        if (!feeSplit) {
          // Fallback: Calculate 50/50 split from platform fee
          this.logger.warn(
            `feeSplit record missing for split fee escrow ${escrow.id}. Calculating 50/50 split from platform fee as fallback.`,
          );
          sellerFeePortion = platformFeeTotal * 0.5; // 50% of fee
        } else {
          sellerFeePortion = feeSplit.sellerPays;
        }

        const sellerBalance = await this.ledgerClient.checkBalance(
          escrow.sellerId,
          sellerFeePortion,
          escrow.asset,
          escrow.chain,
          jwtToken,
        );
        if (!sellerBalance.sufficient) {
          throw new BadRequestException(
            `Insufficient seller balance for fee portion. Required: ${sellerFeePortion} ${escrow.asset}, Available: ${sellerBalance.available} ${escrow.asset}`,
          );
        }
      } else if (feePaidBy === 'seller') {
        // Case 3: No Fee at creation - Seller pays full fee at accept
        const sellerBalance = await this.ledgerClient.checkBalance(
          escrow.sellerId,
          platformFeeTotal,
          escrow.asset,
          escrow.chain,
          jwtToken
        );
        if (!sellerBalance.sufficient) {
          throw new BadRequestException(
            `Insufficient seller balance for fee. Required: ${platformFeeTotal} ${escrow.asset}, Available: ${sellerBalance.available} ${escrow.asset}`,
          );
        }
      }
    } else if (creator === 'seller') {
      // Seller-Created Escrow Cases
      if (feePaidBy === 'seller') {
        // Case 1: Seller pays full fee - Validate buyer balance >= amount
        const buyerBalance = await this.ledgerClient.checkBalance(
          escrow.buyerId,
          escrowAmount,
          escrow.asset,
          escrow.chain,
          jwtToken,
        );
        if (!buyerBalance.sufficient) {
          throw new BadRequestException(
            `Insufficient buyer balance for escrow amount. Required: ${escrowAmount} ${escrow.asset}, Available: ${buyerBalance.available} ${escrow.asset}`,
          );
        }
      } else if (feePaidBy === 'split') {
        // Case 2: Half Fee/Split - Validate buyer balance >= amount + buyer fee portion
        let buyerFeePortion: number;
        if (!feeSplit) {
          // Fallback: Calculate 50/50 split from platform fee
          this.logger.warn(
            `feeSplit record missing for split fee escrow ${escrow.id}. Calculating 50/50 split from platform fee as fallback.`,
          );
          buyerFeePortion = platformFeeTotal * 0.5; // 50% of fee
        } else {
          buyerFeePortion = feeSplit.buyerPays;
        }

        const buyerBalance = await this.ledgerClient.checkBalance(
          escrow.buyerId,
          escrowAmount + buyerFeePortion,
          escrow.asset,
          escrow.chain,
          jwtToken,
        );
        if (!buyerBalance.sufficient) {
          throw new BadRequestException(
            `Insufficient buyer balance. Required: ${escrowAmount + buyerFeePortion} ${escrow.asset}, Available: ${buyerBalance.available} ${escrow.asset}`,
          );
        }
      } else if (feePaidBy === 'buyer') {
        // Case 3: No Fee at creation - Buyer pays amount + full fee at accept
        const buyerBalance = await this.ledgerClient.checkBalance(
          escrow.buyerId,
          escrowAmount + platformFeeTotal,
          escrow.asset,
          escrow.chain,
          jwtToken,
        );
        if (!buyerBalance.sufficient) {
          throw new BadRequestException(
            `Insufficient buyer balance. Required: ${escrowAmount + platformFeeTotal} ${escrow.asset}, Available: ${buyerBalance.available} ${escrow.asset}`,
          );
        }
      }
    } else if (creator === 'broker') {
      // Broker-Created Escrow Cases - All checks happen at acceptance
      // Determine who is accepting
      const isBuyerAccepting = escrow.buyerId === acceptingUserId;
      const isSellerAccepting = escrow.sellerId === acceptingUserId;

      if (feePaidBy === 'split') {
        // Case A: Broker split fees
        // If feeSplit is missing (legacy escrow created before fix), calculate from fees (default 50/50)
        let buyerFeePortion: number;
        let sellerFeePortion: number;

        if (!feeSplit) {
          // Fallback: Calculate 50/50 split from platform fee
          this.logger.warn(
            `feeSplit record missing for split fee escrow ${escrow.id}. Calculating 50/50 split from platform fee as fallback.`,
          );
          buyerFeePortion = platformFeeTotal * 0.5; // 50% of fee
          sellerFeePortion = platformFeeTotal * 0.5; // 50% of fee
        } else {
          buyerFeePortion = feeSplit.buyerPays;
          sellerFeePortion = feeSplit.sellerPays;
        }

        if (isSellerAccepting) {
          // Seller accepting: check seller half fees
          const sellerBalance = await this.ledgerClient.checkBalance(
            escrow.sellerId,
            sellerFeePortion,
            escrow.asset,
            escrow.chain,
            jwtToken,
          );
          if (!sellerBalance.sufficient) {
            throw new BadRequestException(
              `Insufficient seller balance for fee portion. Required: ${sellerFeePortion} ${escrow.asset}, Available: ${sellerBalance.available} ${escrow.asset}`,
            );
          }
        } else if (isBuyerAccepting) {
          // Buyer accepting: check buyer half fees + balance
          const requiredAmount = escrowAmount + buyerFeePortion;
          this.logger.log(
            `Broker-created split fee escrow: Buyer accepting. Checking buyer balance. Required: ${requiredAmount} ${escrow.asset} (amount: ${escrowAmount}, buyer fee portion: ${buyerFeePortion})`,
          );
          const buyerBalance = await this.ledgerClient.checkBalance(
            escrow.buyerId,
            requiredAmount,
            escrow.asset,
            escrow.chain,
            jwtToken,
          );
          if (!buyerBalance.sufficient) {
            throw new BadRequestException(
              `Insufficient buyer balance. Required: ${requiredAmount} ${escrow.asset}, Available: ${buyerBalance.available} ${escrow.asset}`,
            );
          }
        } else {
          throw new BadRequestException(
            'Unable to determine who is accepting the escrow',
          );
        }
      } else if (feePaidBy === 'buyer') {
        // Case B: Broker full fees to buyer
        // When buyer accepts → check buyer full fees + balance
        // No check for seller
        if (isBuyerAccepting) {
          const buyerBalance = await this.ledgerClient.checkBalance(
            escrow.buyerId,
            escrowAmount + platformFeeTotal,
            escrow.asset,
            escrow.chain,
            jwtToken,
          );
          if (!buyerBalance.sufficient) {
            throw new BadRequestException(
              `Insufficient buyer balance. Required: ${escrowAmount + platformFeeTotal} ${escrow.asset}, Available: ${buyerBalance.available} ${escrow.asset}`,
            );
          }
        }
        // If seller is accepting, no balance check needed
      } else if (feePaidBy === 'seller') {
        // Case C: Broker full fees to seller
        // When seller accepts → check seller full fees
        // When buyer accepts → check buyer balance only
        if (isSellerAccepting) {
          const sellerBalance = await this.ledgerClient.checkBalance(
            escrow.sellerId,
            platformFeeTotal,
            escrow.asset,
            escrow.chain,
          );
          if (!sellerBalance.sufficient) {
            throw new BadRequestException(
              `Insufficient seller balance for fee. Required: ${platformFeeTotal} ${escrow.asset}, Available: ${sellerBalance.available} ${escrow.asset}`,
            );
          }
        } else if (isBuyerAccepting) {
          // Buyer accepting: check buyer balance only
          const buyerBalance = await this.ledgerClient.checkBalance(
            escrow.buyerId,
            escrowAmount,
            escrow.asset,
            escrow.chain,
          );
          if (!buyerBalance.sufficient) {
            throw new BadRequestException(
              `Insufficient buyer balance for escrow amount. Required: ${escrowAmount} ${escrow.asset}, Available: ${buyerBalance.available} ${escrow.asset}`,
            );
          }
        }
      }
    }
  }

  /**
   * Accept escrow agreement
   * Authorization rules:
   * - If seller created → buyer accepts
   * - If buyer created → seller accepts
   * - If broker created → both seller and buyer can accept
   */
  async acceptEscrow(
    id: string,
    userId: string,
    acceptDto: AcceptEscrowDto,
    jwtToken?: string,
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);

    // Fix: Check for 'agreement' state, not 'funded'
    if (escrow.state !== 'agreement') {
      throw new BadRequestException(
        'Escrow must be in agreement state to accept',
      );
    }

    // Determine who created the escrow
    const creator = this.determineCreator(
      escrow.createdBy,
      escrow.buyerId,
      escrow.sellerId,
      escrow.brokerId,
    );

    if (!creator) {
      throw new BadRequestException('Unable to determine escrow creator');
    }

    // Authorization: Check if user is allowed to accept based on creator
    let canAccept = false;
    let acceptingRole = '';
    const isBuyerAccepting = escrow.buyerId === userId;
    const isSellerAccepting = escrow.sellerId === userId;

    if (creator === 'buyer') {
      // Buyer created → seller accepts
      if (isSellerAccepting) {
        canAccept = true;
        acceptingRole = 'seller';
      }
    } else if (creator === 'seller') {
      // Seller created → buyer accepts
      if (isBuyerAccepting) {
        canAccept = true;
        acceptingRole = 'buyer';
      }
    } else if (creator === 'broker') {
      // Broker created → both seller and buyer can accept
      if (isSellerAccepting) {
        canAccept = true;
        acceptingRole = 'seller';
      } else if (isBuyerAccepting) {
        canAccept = true;
        acceptingRole = 'buyer';
      }
    }

    if (!canAccept) {
      throw new BadRequestException(
        `Only the counterparty can accept the escrow. Creator: ${creator}, You role: ${isBuyerAccepting ? 'buyer' : isSellerAccepting ? 'seller' : 'unknown'}`,
      );
    }

    // Retrieve escrow with fee information for validation
    const escrowWithFees = await this.escrowRepository.findByIdWithFees(id);
    if (!escrowWithFees) {
      throw new NotFoundException(`Escrow ${id} not found`);
    }

    // For broker-created escrows, check if both parties need to accept
    let bothPartiesAccepted = false;
    let buyerAccepted = false;
    let sellerAccepted = false;

    if (creator === 'broker') {
      // Check transitions to see who has already accepted
      const transitions = await this.transitionRepository.findByEscrowId(id);
      
      // Look for acceptance transitions (agreement -> agreement or agreement -> accepted)
      for (const transition of transitions) {
        if (
          transition.previousState === 'agreement' &&
          (transition.newState === 'agreement' || transition.newState === 'accepted')
        ) {
          if (transition.changedBy === escrow.buyerId) {
            buyerAccepted = true;
          } else if (transition.changedBy === escrow.sellerId) {
            sellerAccepted = true;
          }
        }
      }

      // Check if current user has already accepted
      if (isBuyerAccepting && buyerAccepted) {
        throw new BadRequestException('Buyer has already accepted this escrow');
      }
      if (isSellerAccepting && sellerAccepted) {
        throw new BadRequestException('Seller has already accepted this escrow');
      }

      // Determine if this is the second acceptance
      bothPartiesAccepted = (isBuyerAccepting && sellerAccepted) || (isSellerAccepting && buyerAccepted);
    }

    // Validate balances at acceptance time
    this.logger.log(
      `Validating balances for escrow ${id}. Creator: ${creator}, Accepting: ${acceptingRole}, FeePaidBy: ${escrowWithFees.fees?.paidBy || 'unknown'}`,
    );
    await this.validateAcceptBalance(escrow,  escrowWithFees, userId, jwtToken,);
    this.logger.log(`Balance validation passed for escrow ${id}`);

    let updated: EscrowEntity;
    let newState: string;
    let transitionReason: string;

    if (creator === 'broker' && !bothPartiesAccepted) {
      // First acceptance for broker-created escrow - stay in 'agreement' state
      updated = escrow; // No state change
      newState = 'agreement';
      transitionReason = acceptDto.reason || `Agreement accepted by ${acceptingRole} (waiting for counterparty)`;
      
      // Log transition (agreement -> agreement) to track acceptance
      await this.transitionRepository.create(
        id,
        'agreement',
        'agreement',
        userId,
        transitionReason,
        { acceptingRole, firstAcceptance: true },
      );

      this.logger.log(
        `Broker-created escrow: ${acceptingRole} accepted. Waiting for ${isBuyerAccepting ? 'seller' : 'buyer'} to accept.`,
      );
    } else {
      // Second acceptance (broker-created) or single acceptance (buyer/seller-created)
      // Move to 'accepted' state (not 'funded' - funding happens later via recordPayment)
      updated = await this.escrowRepository.updateState(id, 'accepted');
      newState = 'accepted';
      
      if (creator === 'broker') {
        transitionReason = acceptDto.reason || `Agreement accepted by ${acceptingRole} (both parties accepted)`;
      } else {
        transitionReason = acceptDto.reason || `Agreement accepted by ${acceptingRole}`;
      }

      // Log transition from 'agreement' to 'accepted'
      await this.transitionRepository.create(
        id,
        'agreement',
        'accepted',
        userId,
        transitionReason,
        creator === 'broker' ? { acceptingRole, bothPartiesAccepted: true } : undefined,
      );

      // Publish escrow.accepted event when escrow moves to 'accepted' state
      await this.eventProducer.escrowAccepted(
        escrow.id,
        userId,
        escrow.buyerId,
        escrow.sellerId,
        escrow.amount,
        escrow.asset,
      );

      this.logger.log(`Escrow accepted: ${id} (state: accepted)`);
    }

    return updated;
  }

  /**
   * Cancel escrow (buyer or admin)
   */
  async cancelEscrow(
    id: string,
    userId: string,
    reason: string,
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);
    const previousState = escrow.state;

    const validStates = ['agreement', 'accepted', 'funded'];
    if (!validStates.includes(escrow.state)) {
      throw new BadRequestException(
        `Cannot cancel escrow in ${escrow.state} state`,
      );
    }

    const updated = await this.escrowRepository.updateState(id, 'closed', {
      completedAt: new Date(),
    });

    // Log transition
    await this.transitionRepository.create(
      id,
      escrow.state,
      'closed',
      userId,
      `Cancelled: ${reason}`,
    );

    // Publish escrow.cancelled event
    const hasFunds = previousState === 'funded';
    await this.eventProducer.escrowCancelled(
      escrow.id,
      escrow.buyerId,
      escrow.sellerId,
      userId,
      reason,
      previousState,
      hasFunds,
    );

    this.logger.log(`Escrow cancelled: ${id}`);
    return updated;
  }

  /**
   * Record payment/funding
   * Supports partial payments:
   * - If buyer pays all fees: buyer pays once, escrow becomes funded
   * - If seller pays fees: buyer pays escrow amount, seller pays fees separately
   * - If fees split: buyer pays escrow + buyer fee, seller pays seller fee separately
   * State flow: accepted → funded (only when all payments complete)
   */
  async recordPayment(
    id: string,
    userId: string,
    amount: number,
    jwtToken?: string,
  ): Promise<EscrowEntity> {
    const escrowWithFees = await this.loadEscrowWithFees(id);
    const escrow = escrowWithFees.escrow;

    this.validatePaymentState(escrow);
    this.validateUserCanPay(escrow, userId);

    const feeBreakdown = this.calculateFeeBreakdown(escrowWithFees, escrow);
    const paymentInfo = await this.processPayment(
      escrow,
      userId,
      amount,
      feeBreakdown,
      jwtToken,
    );

    const updateData = this.buildPaymentUpdateData(escrow, userId, paymentInfo);
    const allPaymentsComplete = this.checkAllPaymentsComplete(escrow, feeBreakdown.feePaidBy, updateData);

    if (allPaymentsComplete) {
      updateData.state = 'funded';
    }

    const updated = await this.escrowRepository.updateState(id, escrow.state, updateData);
    await this.logPaymentTransition(id, escrow, userId, paymentInfo, allPaymentsComplete);

    // Publish event immediately for each payment (not waiting for all payments)
    // Ledger will reserve funds incrementally using idempotency keys
    await this.publishPaymentCompletedEvent(escrow, paymentInfo, feeBreakdown);

    if (allPaymentsComplete) {
      this.logger.log(`All payments completed for escrow: ${id}`);
    } else {
      this.logger.log(
        `Partial payment recorded for escrow: ${id}. ${paymentInfo.isBuyer ? 'Buyer' : 'Seller'} paid ${paymentInfo.amount} ${escrow.asset}. Waiting for remaining payments.`,
      );
    }

    return updated;
  }

  /**
   * Load escrow with fee information
   */
  private async loadEscrowWithFees(id: string) {
    const escrowWithFees = await this.escrowRepository.findByIdWithFees(id);
    if (!escrowWithFees) {
      throw new NotFoundException(`Escrow ${id} not found`);
    }
    return escrowWithFees;
  }

  /**
   * Validate escrow is in correct state for payment
   */
  private validatePaymentState(escrow: EscrowEntity): void {
    if (escrow.state !== 'accepted') {
      throw new BadRequestException('Escrow must be in accepted state for payment');
    }
  }

  /**
   * Validate user is buyer or seller
   */
  private validateUserCanPay(escrow: EscrowEntity, userId: string): void {
    const isBuyer = escrow.buyerId === userId;
    const isSeller = escrow.sellerId === userId;

    if (!isBuyer && !isSeller) {
      throw new BadRequestException('Only buyer or seller can process payment');
    }
  }

  /**
   * Calculate fee breakdown based on fee payment model
   */
  private calculateFeeBreakdown(
    escrowWithFees: {
      escrow: EscrowEntity;
      fees: { feeAmount: number; paidBy: string } | null;
      feeSplit: {
        buyerPays: number;
        sellerPays: number;
        paidBy: string;
      } | null;
    },
    escrow: EscrowEntity,
  ) {
    const fees = escrowWithFees.fees;
    const feeSplit = escrowWithFees.feeSplit;
    const feePaidBy = fees?.paidBy || 'buyer';
    const platformFeeTotal = fees?.feeAmount ?? escrow.platformFee ?? 0;

    const normalizedSplit = feeSplit || {
      feeAmount: platformFeeTotal,
      buyerPays: platformFeeTotal * 0.5,
      sellerPays: platformFeeTotal * 0.5,
      brokerPays: null,
      buyerPercent: 50,
      sellerPercent: 50,
      brokerPercent: null,
      paidBy: feePaidBy,
    };

    if (feePaidBy === 'buyer') {
      return {
        feePaidBy,
        buyerFee: platformFeeTotal,
        sellerFee: 0,
        buyerRequired: escrow.amount + platformFeeTotal,
        sellerRequired: 0,
      };
    }

    if (feePaidBy === 'seller') {
      return {
        feePaidBy,
        buyerFee: 0,
        sellerFee: platformFeeTotal,
        buyerRequired: escrow.amount,
        sellerRequired: platformFeeTotal,
      };
    }

    if (feePaidBy === 'split' || feePaidBy === 'broker') {
      const buyerFee = normalizedSplit.buyerPays ?? platformFeeTotal * 0.5;
      const sellerFee = normalizedSplit.sellerPays ?? platformFeeTotal * 0.5;
      return {
        feePaidBy,
        buyerFee,
        sellerFee,
        buyerRequired: escrow.amount + buyerFee,
        sellerRequired: sellerFee,
      };
    }

    // Fallback to buyer pays
    return {
      feePaidBy: 'buyer',
      buyerFee: platformFeeTotal,
      sellerFee: 0,
      buyerRequired: escrow.amount + platformFeeTotal,
      sellerRequired: 0,
    };
  }

  /**
   * Process payment based on user role (buyer or seller)
   */
  private async processPayment(
    escrow: EscrowEntity,
    userId: string,
    amount: number,
    feeBreakdown: {
      feePaidBy: string;
      buyerFee: number;
      sellerFee: number;
      buyerRequired: number;
      sellerRequired: number;
    },
    jwtToken?: string,
  ) {
    const isBuyer = escrow.buyerId === userId;
    const isSeller = escrow.sellerId === userId;

    if (isBuyer) {
      return await this.processBuyerPayment(escrow, amount, feeBreakdown, jwtToken);
    }

    if (isSeller) {
      return await this.processSellerPayment(escrow, amount, feeBreakdown, jwtToken);
    }

    throw new BadRequestException('User must be buyer or seller');
  }

  /**
   * Process buyer payment
   */
  private async processBuyerPayment(
    escrow: EscrowEntity,
    amount: number,
    feeBreakdown: {
      feePaidBy: string;
      buyerFee: number;
      sellerFee: number;
      buyerRequired: number;
      sellerRequired: number;
    },
    jwtToken?: string,
  ) {
    if (escrow.buyerPaid) {
      throw new BadRequestException('Buyer has already completed payment');
    }

    const paymentInfo = this.validateBuyerPaymentAmount(escrow, amount, feeBreakdown);
    await this.validateBalance(escrow.buyerId, paymentInfo.amount, escrow.asset, escrow.chain, jwtToken);

    return { ...paymentInfo, isBuyer: true };
  }

  /**
   * Validate buyer payment amount based on fee payment model
   */
  private validateBuyerPaymentAmount(
    escrow: EscrowEntity,
    amount: number,
    feeBreakdown: {
      feePaidBy: string;
      buyerFee: number;
      buyerRequired: number;
    },
  ) {
    const { feePaidBy, buyerFee, buyerRequired } = feeBreakdown;

    if (feePaidBy === 'buyer') {
      if (amount !== buyerRequired) {
        throw new BadRequestException(
          `Payment amount must be ${buyerRequired} ${escrow.asset} (escrow amount: ${escrow.amount} + fees: ${buyerFee})`,
        );
      }
      return {
        amount,
        buyerPrincipal: escrow.amount,
        buyerFee,
        sellerFee: 0,
        paymentType: 'buyer_principal' as const,
      };
    }

    if (feePaidBy === 'seller') {
      if (amount !== escrow.amount) {
        throw new BadRequestException(
          `Buyer payment amount must match escrow amount: ${escrow.amount} ${escrow.asset}`,
        );
      }
      return {
        amount,
        buyerPrincipal: escrow.amount,
        buyerFee: 0,
        sellerFee: 0,
        paymentType: 'buyer_principal' as const,
      };
    }

    if (feePaidBy === 'split' || feePaidBy === 'broker') {
      if (amount !== buyerRequired) {
        throw new BadRequestException(
          `Payment amount must be ${buyerRequired} ${escrow.asset} (escrow amount: ${escrow.amount} + buyer fee: ${buyerFee})`,
        );
      }
      return {
        amount,
        buyerPrincipal: escrow.amount,
        buyerFee,
        sellerFee: 0,
        paymentType: 'buyer_principal' as const,
      };
    }

    throw new BadRequestException(`Invalid fee payment model: ${feePaidBy}`);
  }

  /**
   * Process seller payment
   */
  private async processSellerPayment(
    escrow: EscrowEntity,
    amount: number,
    feeBreakdown: {
      feePaidBy: string;
      buyerFee: number;
      sellerFee: number;
      sellerRequired: number;
    },
    jwtToken?: string,
  ) {
    if (escrow.sellerPaid) {
      throw new BadRequestException('Seller has already completed payment');
    }

    if (feeBreakdown.feePaidBy === 'buyer') {
      throw new BadRequestException('Seller does not need to pay fees (buyer pays all)');
    }

    if (!escrow.buyerPaid) {
      throw new BadRequestException('Buyer must complete payment before seller can pay fees');
    }

    const paymentInfo = this.validateSellerPaymentAmount(escrow, amount, feeBreakdown, jwtToken);
    await this.validateBalance(escrow.sellerId, paymentInfo.amount, escrow.asset, escrow.chain, jwtToken);

    return { ...paymentInfo, isBuyer: false };
  }

  /**
   * Validate seller payment amount based on fee payment model
   */
  private validateSellerPaymentAmount(
    escrow: EscrowEntity,
    amount: number,
    feeBreakdown: {
      feePaidBy: string;
      sellerFee: number;
    },
    jwtToken?: string,
  ) {
    const { feePaidBy, sellerFee } = feeBreakdown;

    if (amount !== sellerFee) {
      throw new BadRequestException(
        `Seller payment amount must match fee amount: ${sellerFee} ${escrow.asset}`,
      );
    }

    return {
      amount,
      buyerPrincipal: 0,
      buyerFee: 0,
      sellerFee,
      paymentType: 'seller_fee' as const,
    };
  }

  /**
   * Validate user balance
   */
  private async validateBalance(
    userId: string,
    requiredAmount: number,
    asset: string,
    chain: string,
    jwtToken?: string,
  ): Promise<void> {
    const balance = await this.ledgerClient.checkBalance(userId, requiredAmount, asset, chain, jwtToken);
    if (!balance.sufficient) {
      throw new BadRequestException(
        `Insufficient balance. Required: ${requiredAmount} ${asset}, Available: ${balance.available} ${asset}`,
      );
    }
  }

  /**
   * Build payment update data based on who is paying
   */
  private buildPaymentUpdateData(
    escrow: EscrowEntity,
    userId: string,
    paymentInfo: {
      amount: number;
      isBuyer: boolean;
    },
  ) {
    const isBuyer = escrow.buyerId === userId;
    const updateData: any = {};

    if (isBuyer) {
      updateData.buyerPaid = true;
      updateData.buyerPaidAmount = paymentInfo.amount;
      return updateData;
    }

    updateData.sellerPaid = true;
    updateData.sellerPaidAmount = paymentInfo.amount;
    return updateData;
  }

  /**
   * Check if all required payments are complete
   */
  private checkAllPaymentsComplete(
    escrow: EscrowEntity,
    feePaidBy: string,
    updateData: any,
  ): boolean {
    const newBuyerPaid = updateData.buyerPaid ?? escrow.buyerPaid ?? false;
    const newSellerPaid = updateData.sellerPaid ?? escrow.sellerPaid ?? false;

    if (feePaidBy === 'buyer') {
      return newBuyerPaid;
    }

    if (feePaidBy === 'seller') {
      return newBuyerPaid && newSellerPaid;
    }

    if (feePaidBy === 'split' || feePaidBy === 'broker') {
      return newBuyerPaid && newSellerPaid;
    }

    return false;
  }

  /**
   * Log payment transition
   */
  private async logPaymentTransition(
    id: string,
    escrow: EscrowEntity,
    userId: string,
    paymentInfo: {
      amount: number;
      buyerPrincipal: number;
      buyerFee: number;
      sellerFee: number;
      paymentType: string;
      isBuyer: boolean;
    },
    allPaymentsComplete: boolean,
  ): Promise<void> {
    const transitionReason = paymentInfo.isBuyer
      ? `Buyer payment: ${paymentInfo.buyerPrincipal > 0 ? `${paymentInfo.buyerPrincipal} principal` : ''}${paymentInfo.buyerFee > 0 ? ` + ${paymentInfo.buyerFee} fees` : ''}`
      : `Seller payment: ${paymentInfo.sellerFee} fees`;

    await this.transitionRepository.create(
      id,
      escrow.state,
      allPaymentsComplete ? 'funded' : escrow.state,
      userId,
      transitionReason,
      {
        amount: paymentInfo.amount,
        buyerFee: paymentInfo.buyerFee,
        sellerFee: paymentInfo.sellerFee,
        buyerPrincipal: paymentInfo.buyerPrincipal,
        paymentType: paymentInfo.paymentType,
        allPaymentsComplete,
      },
    );
  }

  /**
   * Publish payment completed event for partial payments
   * Publishes immediately when buyer or seller pays (not waiting for all payments)
   */
  private async publishPaymentCompletedEvent(
    escrow: EscrowEntity,
    paymentInfo: {
      amount: number;
      buyerPrincipal: number;
      buyerFee: number;
      sellerFee: number;
      paymentType: string;
      isBuyer: boolean;
    },
    feeBreakdown: {
      feePaidBy: string;
      buyerFee: number;
      sellerFee: number;
    },
  ): Promise<void> {
    // Publish event with only the amounts being paid in this transaction
    // Ledger will handle idempotency and only reserve what's in the event
    await this.eventProducer.paymentCompleted(
      escrow.id,
      escrow.buyerId,
      escrow.sellerId,
      escrow.amount, // Total escrow amount (for reference)
      escrow.asset,
      escrow.chain,
      undefined,
      undefined,
      {
        // Only include fees that are being paid in THIS transaction
        buyerFee: paymentInfo.buyerFee,
        sellerFee: paymentInfo.sellerFee,
        buyerAmount: paymentInfo.buyerPrincipal, // Only the principal being paid now
      },
    );
  }

  /**
   * Record delivery
   */
  async recordDelivery(
    id: string,
    userId: string,
    deliveryProof: string,
    notes?: string,
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);

    if (escrow.state !== 'funded') {
      throw new BadRequestException('Escrow must be funded before delivery');
    }

    if (escrow.sellerId !== userId) {
      throw new BadRequestException('Only seller can record delivery');
    }

    const updated = await this.escrowRepository.updateState(id, 'delivery');

    // Log transition
    await this.transitionRepository.create(
      id,
      'funded',
      'delivery',
      userId,
      'Delivery recorded',
      { deliveryProof, notes },
    );

    // Publish escrow.delivery.started event
    // Calculate inspection deadline (e.g., 7 days from now)
    const inspectionDeadline = new Date();
    inspectionDeadline.setDate(inspectionDeadline.getDate() + 7);

    await this.eventProducer.deliveryStarted(
      escrow.id,
      escrow.sellerId,
      escrow.buyerId,
      deliveryProof,
      notes,
      inspectionDeadline.toISOString(),
    );

    this.logger.log(`Delivery recorded for escrow: ${id}`);
    return updated;
  }

  /**
   * Record inspection
   */
  async recordInspection(
    id: string,
    userId: string,
    notes: string,
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);

    if (escrow.state !== 'delivery') {
      throw new BadRequestException('Escrow must be delivered before inspection');
    }

    if (escrow.buyerId !== userId) {
      throw new BadRequestException('Only buyer can record inspection');
    }

    const updated = await this.escrowRepository.updateState(id, 'inspection');

    // Log transition
    await this.transitionRepository.create(
      id,
      'delivery',
      'inspection',
      userId,
      `Inspection recorded`,
      { notes },
    );

    // Publish escrow.inspection.completed event
    await this.eventProducer.inspectionCompleted(
      escrow.id,
      escrow.buyerId,
      escrow.sellerId,
      'accepted',
      notes,
    );

    this.logger.log(`Inspection recorded for escrow: ${id}`);
    return updated;
  }

  /**
   * Complete escrow (buyer triggers completion)
   * Allowed state: inspection
   */
  async completeEscrow(id: string, userId: string): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);

    if (escrow.state !== 'inspection') {
      throw new BadRequestException('Escrow must be in inspection state to complete');
    }

    if (escrow.buyerId !== userId) {
      throw new BadRequestException('Only buyer can complete the escrow');
    }

    const updated = await this.escrowRepository.updateState(id, 'completed', {
      completedAt: new Date(),
    });

    await this.transitionRepository.create(
      id,
      'inspection',
      'completed',
      userId,
      'Escrow completed',
    );

    // Calculate fee breakdown to include in event
    const escrowWithFees = await this.loadEscrowWithFees(id);
    const feeBreakdown = this.calculateFeeBreakdown(escrowWithFees, escrow);

    await this.eventProducer.escrowCompleted(
      escrow.id,
      escrow.buyerId,
      escrow.sellerId,
      escrow.amount,
      escrow.asset,
      escrow.chain,
      escrow.platformFee,
      feeBreakdown.buyerFee,
      feeBreakdown.sellerFee,
    );

    this.logger.log(`Escrow completed: ${id}`);
    return updated;
  }

  /**
   * File dispute
   */
  async fileDispute(
    id: string,
    userId: string,
    reason: string,
    evidence?: string,
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);
    const previousState = escrow.state;

    const validStates = ['accepted', 'funded', 'delivery', 'inspection'];
    if (!validStates.includes(escrow.state)) {
      throw new BadRequestException(
        `Cannot dispute escrow in ${escrow.state} state`,
      );
    }

    this.logger.debug(
      `[fileDispute] Checking party validation - userId: ${userId}, buyerId: ${escrow.buyerId}, sellerId: ${escrow.sellerId}`,
    );
    this.logger.debug(
      `[fileDispute] Buyer match: ${escrow.buyerId === userId}, Seller match: ${escrow.sellerId === userId}`,
    );

    const isParty = escrow.buyerId === userId || escrow.sellerId === userId;
    if (!isParty) {
      this.logger.warn(
        `[fileDispute] User ${userId} is not a party to escrow ${id}. Buyer: ${escrow.buyerId}, Seller: ${escrow.sellerId}`,
      );
      throw new BadRequestException('Only buyer or seller can file a dispute');
    }

    const updated = await this.escrowRepository.updateState(id, 'disputed', {
      disputedAt: new Date(),
      disputedBy: userId,
    });

    // Log transition
    await this.transitionRepository.create(
      id,
      escrow.state,
      'disputed',
      userId,
      `Dispute filed: ${reason}`,
      { evidence },
    );

    // Publish escrow.disputed event
    await this.eventProducer.disputeOpened(
      escrow.id,
      userId,
      escrow.buyerId,
      escrow.sellerId,
      escrow.amount,
      escrow.asset,
      reason,
      previousState,
      evidence,
    );

    this.logger.log(`Dispute filed for escrow: ${id}`);
    return updated;
  }

  /**
   * Get escrow history/transitions
   */
  async getEscrowHistory(
    id: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<any> {
    await this.getEscrow(id); // Verify escrow exists

    return this.transitionRepository.findByEscrowIdPaginated(id, skip, take);
  }

  /**
   * Get all escrows (admin)
   */
  async getAllEscrows(
    skip: number = 0,
    take: number = 50,
  ): Promise<{ data: EscrowEntity[]; total: number }> {
    return this.escrowRepository.findAll(skip, take);
  }

  /**
   * Get escrow statistics
   */
  async getStatistics(): Promise<Record<string, number>> {
    return this.escrowRepository.getStatistics();
  }

  /**
   * Resolve dispute (admin only)
   * Determines outcome: buyer_wins, seller_wins, or refund
   */
  async resolveDispute(
    id: string,
    adminId: string,
    resolution: 'buyer_wins' | 'seller_wins' | 'refund',
    adminNotes: string,
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);

    if (escrow.state !== 'disputed') {
      throw new BadRequestException(
        'Can only resolve escrows in disputed state',
      );
    }

    const updated = await this.escrowRepository.updateState(id, 'closed', {
      completedAt: new Date(),
      disputeResolution: resolution,
      disputeResolvedBy: adminId,
      disputeResolvedAt: new Date(),
    });

    // Log transition
    await this.transitionRepository.create(
      id,
      'disputed',
      'closed',
      adminId,
      `Dispute resolved: ${resolution}`,
      { resolution, adminNotes },
    );

    // Publish escrow.resolved event
    await this.eventProducer.disputeResolved(
      escrow.id,
      escrow.buyerId,
      escrow.sellerId,
      escrow.amount,
      escrow.asset,
      escrow.chain,
      resolution,
      adminId,
      adminNotes,
    );

    this.logger.log(`Dispute resolved for escrow: ${id} - ${resolution}`);
    return updated;
  }

  /**
   * Admin force close escrow
   * Can close escrow in any state (emergency action)
   */
  async adminForceClose(
    id: string,
    adminId: string,
    reason: string,
    fundsAction?: 'refund_buyer' | 'release_seller' | 'no_action',
  ): Promise<EscrowEntity> {
    const escrow = await this.getEscrow(id);
    const previousState = escrow.state;

    if (escrow.state === 'closed') {
      throw new BadRequestException('Escrow is already closed');
    }

    const updated = await this.escrowRepository.updateState(id, 'closed', {
      completedAt: new Date(),
      forceClosedBy: adminId,
      forceClosedAt: new Date(),
      forceCloseReason: reason,
    });

    // Log transition
    await this.transitionRepository.create(
      id,
      escrow.state,
      'closed',
      adminId,
      `Admin force closed: ${reason}`,
      { previousState: escrow.state, fundsAction: fundsAction || 'no_action' },
    );

    // Publish escrow.force.closed event
    await this.eventProducer.forceClosed(
      escrow.id,
      escrow.buyerId,
      escrow.sellerId,
      escrow.amount,
      adminId,
      reason,
      previousState,
      fundsAction || 'no_action',
    );

    this.logger.log(`Escrow force closed: ${id}`);
    return updated;
  }

  /**
   * Convert EscrowEntity to EscrowSnapshot for events
   */
  private toSnapshot(escrow: EscrowEntity): EscrowSnapshot {
    return {
      id: escrow.id,
      buyerId: escrow.buyerId,
      sellerId: escrow.sellerId,
      brokerId: escrow.brokerId,
      amount: escrow.amount,
      asset: escrow.asset,
      chain: escrow.chain,
      platformFee: escrow.platformFee,
      state: escrow.state,
      description: escrow.description,
      createdBy: escrow.createdBy,
      createdAt: escrow.createdAt.toISOString(),
      expiresAt: escrow.expiresAt?.toISOString(),
    };
  }
}
