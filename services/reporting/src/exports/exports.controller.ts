import { Controller, Get, Query, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, Public } from '@escrowly/auth-common';
import { ExportsService } from './exports.service';
import { ExportQueryDto, DailyExportDto, ManualExportDto } from './dto';

/**
 * Exports Controller
 *
 * READ-ONLY endpoints for data exports to S3/Data Lake.
 */
@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({
    path: 'exports',
    version: '1',
})
export class ExportsController {
    private readonly logger = new Logger(ExportsController.name);

    constructor(private readonly exportsService: ExportsService) { }

    @Get('daily')
    @ApiOperation({ summary: 'Get daily export data' })
    @ApiResponse({ status: 200, description: 'Daily export data', type: DailyExportDto })
    async getDailyExport(@Query() query: ExportQueryDto): Promise<DailyExportDto> {
        this.logger.debug('Fetching daily export data');
        return this.exportsService.getDailyExport(query);
    }

    @Get('manual')
    @ApiOperation({ summary: 'Trigger manual export' })
    @ApiResponse({ status: 200, description: 'Manual export triggered', type: ManualExportDto })
    async triggerManualExport(@Query() query: ExportQueryDto): Promise<ManualExportDto> {
        this.logger.debug('Triggering manual export');
        return this.exportsService.triggerManualExport(query);
    }
}
