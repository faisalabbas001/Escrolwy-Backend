import { Injectable } from "@nestjs/common";
import { EmailPreferencesDto } from "../api/dto/notification-settings.dto";

/**
 * Preferences Mapper Service
 *
 * Maps between API format (grouped preferences) and database format (granular fields)
 *
 * API Format:
 * {
 *   preferences: {
 *     transaction_events: boolean,
 *     account_events: boolean,
 *     milestone_events: boolean,
 *     marketing_emails: boolean
 *   }
 * }
 *
 * Database Format:
 * {
 *   emailInquiryMessages: boolean,
 *   emailInquiryResolved: boolean,
 *   emailEscrowCreated: boolean,
 *   emailEscrowCompleted: boolean,
 *   emailEscrowDisputed: boolean,
 *   emailWalletDeposit: boolean,
 *   emailWalletWithdrawal: boolean,
 *   emailPasswordChanged: boolean,
 *   emailEmailUpdated: boolean
 * }
 */
@Injectable()
export class PreferencesMapperService {
  /**
   * Convert API preferences to database format
   */
  apiToDb(preferences: EmailPreferencesDto): {
    emailInquiryMessages: boolean;
    emailInquiryResolved: boolean;
    emailEscrowCreated: boolean;
    emailEscrowCompleted: boolean;
    emailEscrowDisputed: boolean;
    emailWalletDeposit: boolean;
    emailWalletWithdrawal: boolean;
    emailPasswordChanged: boolean;
    emailEmailUpdated: boolean;
  } {
    // Default to true if not specified (opt-out model)
    const transactionEvents = preferences.transaction_events ?? true;
    const accountEvents = preferences.account_events ?? true;
    const milestoneEvents = preferences.milestone_events ?? true;
    // marketing_emails is not mapped to any DB field (future feature)

    return {
      // Inquiry messages - always enabled (not grouped)
      emailInquiryMessages: true,
      // Milestone events → inquiry resolved
      emailInquiryResolved: milestoneEvents,
      // Transaction events → escrow events
      emailEscrowCreated: transactionEvents,
      emailEscrowCompleted: transactionEvents,
      emailEscrowDisputed: transactionEvents,
      // Transaction events → wallet events
      emailWalletDeposit: transactionEvents,
      emailWalletWithdrawal: transactionEvents,
      // Account events
      emailPasswordChanged: accountEvents,
      emailEmailUpdated: accountEvents,
    };
  }

  /**
   * Convert database format to API preferences
   */
  dbToApi(dbSettings: {
    emailInquiryMessages: boolean;
    emailInquiryResolved: boolean;
    emailEscrowCreated: boolean;
    emailEscrowCompleted: boolean;
    emailEscrowDisputed: boolean;
    emailWalletDeposit: boolean;
    emailWalletWithdrawal: boolean;
    emailPasswordChanged: boolean;
    emailEmailUpdated: boolean;
  }): EmailPreferencesDto {
    // Aggregate granular fields into grouped preferences
    // If any transaction event is enabled, transaction_events is true
    const transactionEvents =
      dbSettings.emailEscrowCreated ||
      dbSettings.emailEscrowCompleted ||
      dbSettings.emailEscrowDisputed ||
      dbSettings.emailWalletDeposit ||
      dbSettings.emailWalletWithdrawal;

    // If any account event is enabled, account_events is true
    const accountEvents =
      dbSettings.emailPasswordChanged || dbSettings.emailEmailUpdated;

    // Milestone events → inquiry resolved
    const milestoneEvents = dbSettings.emailInquiryResolved;

    return {
      transaction_events: transactionEvents,
      account_events: accountEvents,
      milestone_events: milestoneEvents,
      marketing_emails: false, // Not stored in DB yet
    };
  }
}

