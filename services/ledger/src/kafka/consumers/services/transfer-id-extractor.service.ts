import { Injectable, Logger } from '@nestjs/common';

/**
 * Transfer ID Extractor Service
 *
 * Single Responsibility: Extracts transfer ID from transaction ID
 * Follows Single Responsibility Principle (SRP)
 */
@Injectable()
export class TransferIdExtractorService {
  private readonly logger = new Logger(TransferIdExtractorService.name);

  /**
   * Extract transfer ID from transaction ID
   * Supports formats:
   * - "transfer-{transferId}" -> extracts transferId
   * - "{transferId}" -> returns as-is
   *
   * @param transactionId Transaction ID that may contain transfer ID
   * @returns Transfer ID or null if not found
   */
  extract(transactionId: string): string | null {
    if (!transactionId) {
      this.logger.warn('Empty transactionId provided');
      return null;
    }

    // Check if format is "transfer-{transferId}"
    if (transactionId.includes('transfer-')) {
      return transactionId.replace('transfer-', '');
    }

    // Assume transactionId is the transferId itself
    return transactionId;
  }
}

