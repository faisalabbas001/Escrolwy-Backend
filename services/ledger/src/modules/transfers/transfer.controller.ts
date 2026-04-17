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
import { TransferService } from './transfer.service';
import { CreateTransferDto, TransferResponseDto } from './dto/create-transfer.dto';
import {
  ApiCreateTransfer,
  ApiGetTransfer,
} from './docs/transfer.swagger';
import { TransferApiTag } from './docs/transfer.tags';

/**
 * Transfer Controller
 *
 * Handles all transfer-related HTTP requests.
 * Protected by JwtAuthGuard globally - use @Public() for public routes.
 * Role-based access via @Roles() decorator.
 */
@TransferApiTag()
@Controller({
  path: 'ledger/transfers',
  version: '1',
})
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  /**
   * Create a new transfer
   * Main entry point for money movement
   */
  @ApiCreateTransfer()
  @Roles(Role.USER)
  @Post()
  async createTransfer(
    @Body() createTransferDto: CreateTransferDto,
    @CurrentUser('id') userId?: string,
  ): Promise<TransferResponseDto> {
    // Temporary fallback while auth is disabled for testing
    const senderId = userId || '11111111-1111-4111-8111-111111111111';
    return this.transferService.createTransfer(createTransferDto, senderId);
  }

  /**
   * Get transfer by ID
   * Used by Wallet UI, Escrow UI, Support
   */
  @ApiGetTransfer()
  @Get(':id')
  async getTransfer(
    @Param('id') id: string,
  ): Promise<TransferResponseDto> {
    return this.transferService.getTransfer(id);
  }
}

