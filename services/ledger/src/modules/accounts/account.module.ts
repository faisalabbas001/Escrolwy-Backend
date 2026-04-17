import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountRepository } from '../transfers/repository/account.repository';
import { AccountMapperService } from './mappers';
import { AccountValidatorService } from './validators';

/**
 * Account Module
 *
 * Handles all account and balance-related operations
 * Follows SOLID principles with separated concerns
 */
@Module({
  controllers: [AccountController],
  providers: [
    // Main service
    AccountService,
    // Repository (implements interface)
    AccountRepository,
    // Mappers (SRP)
    AccountMapperService,
    // Validators (SRP)
    AccountValidatorService,
  ],
  exports: [AccountService],
})
export class AccountModule {}

