import { Controller, Get, Query, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@escrowly/auth-common';
import { ReportsService } from './reports.service';
import {
    DateRangeQueryDto,
    CurrencyQueryDto,
    EscrowSummaryDto,
    EscrowTrendDto,
    TransactionVolumeDto,
    FeesReportDto,
    CurrencyBreakdownDto,
    KycDistributionDto,
    ActiveUsersDto,
    WalletDepositsDto,
    WalletWithdrawalsDto,
} from './dto';

/**
 * Reports Controller
 *
 * READ-ONLY endpoints for escrow, transaction, user, and wallet reports.
 * All data is aggregated from Kafka events and stored in reporting_db.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({
    path: 'reports',
    version: '1',
})
export class ReportsController {
    private readonly logger = new Logger(ReportsController.name);

    constructor(private readonly reportsService: ReportsService) { }

    // ====================================
    // ESCROW & TRANSACTION REPORTS
    // ====================================

    @Get('escrows/summary')
    @ApiOperation({ summary: 'Get escrow summary statistics' })
    @ApiResponse({ status: 200, description: 'Escrow summary', type: EscrowSummaryDto })
    async getEscrowSummary(@Query() query: DateRangeQueryDto): Promise<EscrowSummaryDto> {
        this.logger.debug('Fetching escrow summary');
        return this.reportsService.getEscrowSummary(query);
    }

    @Get('escrows/trends')
    @ApiOperation({ summary: 'Get escrow trend analysis' })
    @ApiResponse({ status: 200, description: 'Escrow trends', type: [EscrowTrendDto] })
    async getEscrowTrends(@Query() query: DateRangeQueryDto): Promise<EscrowTrendDto[]> {
        this.logger.debug('Fetching escrow trends');
        return this.reportsService.getEscrowTrends(query);
    }

    @Get('transactions/volume')
    @ApiOperation({ summary: 'Get transaction volume metrics' })
    @ApiResponse({ status: 200, description: 'Transaction volumes', type: [TransactionVolumeDto] })
    async getTransactionVolume(@Query() query: DateRangeQueryDto): Promise<TransactionVolumeDto[]> {
        this.logger.debug('Fetching transaction volume');
        return this.reportsService.getTransactionVolume(query);
    }

    @Get('fees')
    @ApiOperation({ summary: 'Get fee collection reports' })
    @ApiResponse({ status: 200, description: 'Fees report', type: [FeesReportDto] })
    async getFees(@Query() query: DateRangeQueryDto): Promise<FeesReportDto[]> {
        this.logger.debug('Fetching fees report');
        return this.reportsService.getFees(query);
    }

    @Get('currencies')
    @ApiOperation({ summary: 'Get currency breakdown' })
    @ApiResponse({ status: 200, description: 'Currency breakdown', type: [CurrencyBreakdownDto] })
    async getCurrencies(@Query() query: DateRangeQueryDto): Promise<CurrencyBreakdownDto[]> {
        this.logger.debug('Fetching currency breakdown');
        return this.reportsService.getCurrencies(query);
    }

    // ====================================
    // USER & WALLET INSIGHTS
    // ====================================

    @Get('users/kyc-distribution')
    @ApiOperation({ summary: 'Get KYC status distribution' })
    @ApiResponse({ status: 200, description: 'KYC distribution', type: [KycDistributionDto] })
    async getKycDistribution(): Promise<KycDistributionDto[]> {
        this.logger.debug('Fetching KYC distribution');
        return this.reportsService.getKycDistribution();
    }

    @Get('users/active')
    @ApiOperation({ summary: 'Get active user metrics' })
    @ApiResponse({ status: 200, description: 'Active users', type: [ActiveUsersDto] })
    async getActiveUsers(@Query() query: DateRangeQueryDto): Promise<ActiveUsersDto[]> {
        this.logger.debug('Fetching active users');
        return this.reportsService.getActiveUsers(query);
    }

    @Get('wallets/deposits')
    @ApiOperation({ summary: 'Get deposit analytics' })
    @ApiResponse({ status: 200, description: 'Deposit analytics', type: [WalletDepositsDto] })
    async getWalletDeposits(@Query() query: CurrencyQueryDto): Promise<WalletDepositsDto[]> {
        this.logger.debug('Fetching wallet deposits');
        return this.reportsService.getWalletDeposits(query);
    }

    @Get('wallets/withdrawals')
    @ApiOperation({ summary: 'Get withdrawal analytics' })
    @ApiResponse({ status: 200, description: 'Withdrawal analytics', type: [WalletWithdrawalsDto] })
    async getWalletWithdrawals(@Query() query: CurrencyQueryDto): Promise<WalletWithdrawalsDto[]> {
        this.logger.debug('Fetching wallet withdrawals');
        return this.reportsService.getWalletWithdrawals(query);
    }
}
