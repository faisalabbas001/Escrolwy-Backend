import {
  Controller,
  Post,
  Get,
  Body,
  Param,
} from '@nestjs/common';
import {
  Roles,
  CurrentUser,
  Role,
} from '@escrowly/auth-common';
import { InternalTransferService } from './internal-transfer.service';
import { CreateInternalTransferDto, InternalTransferResponseDto } from './dto';

/**
 * Internal Transfer Controller
 *
 * Single Responsibility: Handles HTTP requests for internal transfers (user-to-user)
 * Follows Single Responsibility Principle (SRP)
 * 
 * Allows authenticated users to transfer funds to other registered users within Escrowly
 */
@Controller({
  path: 'ledger/internal/transfer',
  version: '1',
})
export class InternalTransferController {
  constructor(private readonly internalTransferService: InternalTransferService) {}

  /**
   * Create a new internal transfer (user-to-user)
   * Transfers funds from authenticated user to another registered user
   */
  @Roles(Role.USER)
  @Post()
  async createInternalTransfer(
    @Body() createDto: CreateInternalTransferDto,
    @CurrentUser('id') userId: string,
  ): Promise<InternalTransferResponseDto> {
    // const userId = '11111111-1111-4111-8111-111111111111';
    return this.internalTransferService.createInternalTransfer(createDto, userId);
  }

  /**
   * Get internal transfer by ID
   */
  @Get(':id')
  async getInternalTransfer(
    @Param('id') id: string,
  ): Promise<InternalTransferResponseDto> {
    return this.internalTransferService.getInternalTransfer(id);
  }
}

