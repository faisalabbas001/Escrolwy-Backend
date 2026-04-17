import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { ILedgerClient, LEDGER_CLIENT_TOKEN } from '../services/interfaces/ledger-client.interface';
import { calculatePlatformFee } from '../../../common/config/platform-fees.config';

/**
 * Fee Validator Service
 *
 * Single Responsibility: Validates fee payment scenarios
 * Follows Single Responsibility Principle (SRP)
 * Depends on ILedgerClient interface (Dependency Inversion Principle)
 */
@Injectable()
export class FeeValidatorService {
  private readonly logger = new Logger(FeeValidatorService.name);

  constructor(@Inject(LEDGER_CLIENT_TOKEN) private readonly ledgerClient: ILedgerClient) {}

  /**
   * Validate fee payment based on escrow creation role and fee configuration
   * CRITICAL: When seller creates escrow, always validate buyer balance for escrow_amount first
   * 
   * @param jwtToken - Optional JWT token to forward to Ledger service for authentication
   */
  async validateFeePayment(
    createEscrowDto: CreateEscrowDto,
    createdBy: 'buyer' | 'seller' | 'broker',
    jwtToken?: string,
  ): Promise<void> {
    const escrowAmount = createEscrowDto.amount;
    const feePaidBy = createEscrowDto.feePaidBy || 'buyer';
    
    // Default to 50/50 split if feePaidBy is 'split' but feeSplitPercentages is not provided
    let feeSplitPercentages = createEscrowDto.feeSplitPercentages;
    if (feePaidBy === 'split' && !feeSplitPercentages) {
      feeSplitPercentages = { buyer: 50, seller: 50 };
      this.logger.log('feePaidBy is "split" but feeSplitPercentages not provided. Defaulting to 50/50 split.');
    }
    
    // Use calculatePlatformFee from config instead of default fee
    const feeInfo = calculatePlatformFee(escrowAmount);
    const platformFeeTotal = createEscrowDto.platformFeeTotal || feeInfo.feeAmount;

    // Broker-created escrows skip creation-time balance checks
    // All balance checks happen at acceptance time only
    if (createdBy === 'broker') {
      this.logger.log('Broker-created escrow: Skipping creation-time balance checks. Validation will occur at acceptance time.');
      return;
    }

    if (createdBy === 'buyer') {
      await this.validateBuyerCreated(createEscrowDto, escrowAmount, platformFeeTotal, feePaidBy, feeSplitPercentages, jwtToken);
    } else if (createdBy === 'seller') {
      await this.validateSellerCreated(createEscrowDto, escrowAmount, platformFeeTotal, feePaidBy, feeSplitPercentages, jwtToken);
    }
  }

  /**
   * Validate buyer-created escrow
   * CASE A1: Buyer pays full → Check buyer balance >= (escrow_amount + platform_fee)
   * CASE A2: Split 50/50 → Check buyer >= (escrow_amount + buyer_fee_portion), seller >= seller_fee_portion (on accept)
   * CASE A3: Seller pays full → Check buyer >= escrow_amount, seller >= platform_fee (on accept)
   */
  private async validateBuyerCreated(
    createEscrowDto: CreateEscrowDto,
    escrowAmount: number,
    platformFeeTotal: number,
    feePaidBy: string,
    feeSplitPercentages?: { buyer?: number; seller?: number; broker?: number },
    jwtToken?: string,
  ): Promise<void> {
    if (feePaidBy === 'buyer') {
      // A1: Buyer pays full fee
      const buyerBalance = await this.ledgerClient.checkBalance(
        createEscrowDto.buyerId,
        escrowAmount + platformFeeTotal,
        createEscrowDto.asset,
        createEscrowDto.chain,
        jwtToken,
      );
      if (!buyerBalance.sufficient) {
        throw new BadRequestException(
          `Insufficient buyer balance. Required: ${escrowAmount + platformFeeTotal} ${createEscrowDto.asset}, Available: ${buyerBalance.available} ${createEscrowDto.asset}`,
        );
      }
    } else if (feePaidBy === 'split') {
      // A2: Split fee (Half Fee = 50/50 split)
      // feeSplitPercentages should already be defaulted to 50/50 if not provided (handled in validateFeePayment)
      // But we still validate it exists and has valid values
      if (!feeSplitPercentages) {
        throw new BadRequestException(
          'feeSplitPercentages is required when feePaidBy is "split"',
        );
      }
      
      // Validate that buyer percentage is provided and > 0
      const buyerPercent = feeSplitPercentages.buyer || 0;
      if (buyerPercent <= 0) {
        throw new BadRequestException(
          'feeSplitPercentages.buyer must be greater than 0 when feePaidBy is "split"',
        );
      }

      const buyerFeePortion = (platformFeeTotal * buyerPercent) / 100;
      const buyerBalance = await this.ledgerClient.checkBalance(
        createEscrowDto.buyerId,
        escrowAmount + buyerFeePortion,
        createEscrowDto.asset,
        createEscrowDto.chain,
        jwtToken,
      );
      if (!buyerBalance.sufficient) {
        throw new BadRequestException(
          `Insufficient buyer balance. Required: ${escrowAmount + buyerFeePortion} ${createEscrowDto.asset}, Available: ${buyerBalance.available} ${createEscrowDto.asset}`,
        );
      }
      // Seller fee will be validated on accept
    } else if (feePaidBy === 'seller') {
      // A3: Seller pays full fee (No Fee at creation - seller pays at accept)
      const buyerBalance = await this.ledgerClient.checkBalance(
        createEscrowDto.buyerId,
        escrowAmount,
        createEscrowDto.asset,
        createEscrowDto.chain,
        jwtToken,
      );
      if (!buyerBalance.sufficient) {
        throw new BadRequestException(
          `Insufficient buyer balance. Required: ${escrowAmount} ${createEscrowDto.asset}, Available: ${buyerBalance.available} ${createEscrowDto.asset}`,
        );
      }
      // Seller fee will be validated on accept
    } else {
      // Fallback: Invalid feePaidBy value
      throw new BadRequestException(
        `Invalid feePaidBy value: ${feePaidBy}. Must be "buyer", "seller", or "split"`,
      );
    }
  }

  /**
   * Validate seller-created escrow
   * CASE B1: Seller pays full fee → Check seller >= platform_fee only (buyer pays amount at accept)
   * CASE B2: Buyer pays full fee → No balance checks at creation (buyer pays amount + fee at accept)
   * CASE B3: Split 50/50 → Check seller >= seller_fee_portion (buyer pays amount + buyer portion at accept)
   */
  private async validateSellerCreated(
    createEscrowDto: CreateEscrowDto,
    escrowAmount: number,
    platformFeeTotal: number,
    feePaidBy: string,
    feeSplitPercentages?: { buyer?: number; seller?: number; broker?: number },
    jwtToken?: string,
  ): Promise<void> {
    if (feePaidBy === 'seller') {
      // B1: Seller pays full fee at creation
      // Only check seller balance for fee - buyer will pay amount at acceptance
      const sellerBalance = await this.ledgerClient.checkBalance(
        createEscrowDto.sellerId,
        platformFeeTotal,
        createEscrowDto.asset,
        createEscrowDto.chain,
        jwtToken,
      );
      if (!sellerBalance.sufficient) {
        throw new BadRequestException(
          `Insufficient seller balance for fee. Required: ${platformFeeTotal} ${createEscrowDto.asset}, Available: ${sellerBalance.available} ${createEscrowDto.asset}`,
        );
      }
      // Buyer balance for escrow amount will be validated on accept
    } else if (feePaidBy === 'buyer') {
      // B2: Buyer pays full fee (No Fee at creation - buyer pays amount + fee at accept)
      // No balance checks at creation time - buyer will pay everything at acceptance
      this.logger.log('Seller-created escrow with buyer paying fee: Skipping creation-time balance checks. Buyer will pay amount + fee at acceptance.');
    } else if (feePaidBy === 'split') {
      // B3: Split fee (Half Fee = 50/50 split)
      // feeSplitPercentages should already be defaulted to 50/50 if not provided (handled in validateFeePayment)
      // But we still validate it exists and has valid values
      if (!feeSplitPercentages) {
        throw new BadRequestException(
          'feeSplitPercentages is required when feePaidBy is "split"',
        );
      }
      
      // Validate that seller percentage is provided and > 0
      const sellerPercent = feeSplitPercentages.seller || 0;
      
      if (sellerPercent <= 0) {
        throw new BadRequestException(
          'feeSplitPercentages.seller must be greater than 0 when feePaidBy is "split"',
        );
      }

      const sellerFeePortion = (platformFeeTotal * sellerPercent) / 100;

      // Only check seller balance for seller's fee portion at creation
      // Buyer will pay amount + buyer fee portion at acceptance
      const sellerBalance = await this.ledgerClient.checkBalance(
        createEscrowDto.sellerId,
        sellerFeePortion,
        createEscrowDto.asset,
        createEscrowDto.chain,
        jwtToken,
      );
      if (!sellerBalance.sufficient) {
        throw new BadRequestException(
          `Insufficient seller balance for fee portion. Required: ${sellerFeePortion} ${createEscrowDto.asset}, Available: ${sellerBalance.available} ${createEscrowDto.asset}`,
        );
      }
      // Buyer fee portion will be validated on accept
    } else {
      // Fallback: Invalid feePaidBy value
      throw new BadRequestException(
        `Invalid feePaidBy value: ${feePaidBy}. Must be "buyer", "seller", or "split"`,
      );
    }
  }

}

