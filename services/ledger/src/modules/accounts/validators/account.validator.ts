import { Injectable, NotFoundException } from '@nestjs/common';

/**
 * Account Validator Service
 *
 * Single Responsibility: Validates account-related operations
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class AccountValidatorService {
  /**
   * Validate account exists
   * @param account Account entity or null
   * @param accountId Account ID for error message
   * @throws NotFoundException if account is null
   */
  validateAccountExists(account: any | null, accountId: string): void {
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
  }
}

