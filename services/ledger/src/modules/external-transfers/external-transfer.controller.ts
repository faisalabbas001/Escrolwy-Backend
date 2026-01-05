import {
  Controller,
  Post,
  Get,
  Param,
  Body,
} from '@nestjs/common';
import {
  Roles,
  Role,
  CurrentUser,
} from '@escrowly/auth-common';
import { ExternalTransferService } from './external-transfer.service';
import { CreateExternalTransferDto, ExternalTransferResponseDto } from './dto/external-transfer.dto';

/**
 * External Transfer Controller
 */
@Controller({
  path: 'ledger/external/transfer',
  version: '1',
})
export class ExternalTransferController {
  constructor(private readonly externalTransferService: ExternalTransferService) {}

  @Roles(Role.USER)
  @Post()
  async createExternalTransfer(
    @Body() createDto: CreateExternalTransferDto,
    @CurrentUser('id') userId: string,
  ): Promise<ExternalTransferResponseDto> {
    return this.externalTransferService.createExternalTransfer(createDto, userId);
  }

  @Roles(Role.USER)
  @Get(':id')
  async getExternalTransfer(
    @Param('id') id: string,
  ): Promise<ExternalTransferResponseDto> {
    return this.externalTransferService.getExternalTransfer(id);
  }
}

