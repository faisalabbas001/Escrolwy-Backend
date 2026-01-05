import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ProxyService } from '../proxy';

/**
 * Inquiry Controller (BFF → Inquiry Service)
 * 
 * User-facing endpoints for inquiry management.
 * All routes require JWT authentication (enforced by global guard).
 * 
 * Routes:
 * - POST /api/v1/inquiries - Create inquiry
 * - GET /api/v1/inquiries/:inquiryId - Get inquiry by ID
 * - GET /api/v1/inquiries/escrow/:escrowId - Get inquiry by escrow ID
 * - POST /api/v1/inquiries/:inquiryId/close - Close inquiry
 * - POST /api/v1/inquiries/:inquiryId/messages - Add message
 * - GET /api/v1/inquiries/:inquiryId/messages - List messages
 * - POST /api/v1/inquiries/:inquiryId/attachments - Add attachment
 * - POST /api/v1/inquiries/:inquiryId/attachments/upload - Upload file and create attachment
 * - GET /api/v1/inquiries/:inquiryId/attachments - List attachments
 */
@ApiTags('inquiries')
@Controller({ path: 'inquiries', version: '1' })
export class InquiryController {
  private readonly logger = new Logger(InquiryController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Create a new inquiry
   * POST /api/v1/inquiries
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new inquiry' })
  @ApiResponse({ status: 201, description: 'Inquiry created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 409, description: 'Inquiry already exists for this escrow' })
  async createInquiry(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Inquiry] POST /api/v1/inquiries');
    return this.proxyService.proxyToInquiry(
      'POST',
      '/api/v1/inquiries',
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Get inquiry by ID
   * GET /api/v1/inquiries/:inquiryId
   */
  @Get(':inquiryId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get inquiry by ID' })
  @ApiParam({ name: 'inquiryId', description: 'Inquiry UUID' })
  @ApiResponse({ status: 200, description: 'Inquiry retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async getInquiry(
    @Param('inquiryId') inquiryId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] GET /api/v1/inquiries/${inquiryId}`);
    return this.proxyService.proxyToInquiry(
      'GET',
      `/api/v1/inquiries/${inquiryId}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Get inquiry by escrow ID
   * GET /api/v1/inquiries/escrow/:escrowId
   */
  @Get('escrow/:escrowId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get inquiry for escrow' })
  @ApiParam({ name: 'escrowId', description: 'Escrow ID' })
  @ApiResponse({ status: 200, description: 'Inquiry retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inquiry not found for this escrow' })
  async getInquiryByEscrow(
    @Param('escrowId') escrowId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] GET /api/v1/inquiries/escrow/${escrowId}`);
    return this.proxyService.proxyToInquiry(
      'GET',
      `/api/v1/inquiries/escrow/${escrowId}`,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Close inquiry
   * POST /api/v1/inquiries/:inquiryId/close
   */
  @Post(':inquiryId/close')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Close inquiry' })
  @ApiParam({ name: 'inquiryId', description: 'Inquiry UUID' })
  @ApiResponse({ status: 200, description: 'Inquiry closed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid operation' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async closeInquiry(
    @Param('inquiryId') inquiryId: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] POST /api/v1/inquiries/${inquiryId}/close`);
    return this.proxyService.proxyToInquiry(
      'POST',
      `/api/v1/inquiries/${inquiryId}/close`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Add message to inquiry
   * POST /api/v1/inquiries/:inquiryId/messages
   */
  @Post(':inquiryId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add message to inquiry' })
  @ApiParam({ name: 'inquiryId', description: 'Inquiry UUID' })
  @ApiResponse({ status: 201, description: 'Message added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or inquiry closed' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async addMessage(
    @Param('inquiryId') inquiryId: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] POST /api/v1/inquiries/${inquiryId}/messages`);
    return this.proxyService.proxyToInquiry(
      'POST',
      `/api/v1/inquiries/${inquiryId}/messages`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Get messages for inquiry (paginated)
   * GET /api/v1/inquiries/:inquiryId/messages
   */
  @Get(':inquiryId/messages')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List messages for inquiry (paginated)' })
  @ApiParam({ name: 'inquiryId', description: 'Inquiry UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async getMessages(
    @Param('inquiryId') inquiryId: string,
    @Headers('authorization') authHeader: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    const queryString = queryParams.toString();
    const path = `/api/v1/inquiries/${inquiryId}/messages${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Inquiry] GET ${path}`);
    return this.proxyService.proxyToInquiry(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }

  /**
   * Add attachment to inquiry
   * POST /api/v1/inquiries/:inquiryId/attachments
   */
  @Post(':inquiryId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add attachment to inquiry' })
  @ApiParam({ name: 'inquiryId', description: 'Inquiry UUID' })
  @ApiResponse({ status: 201, description: 'Attachment added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Inquiry or message not found' })
  async addAttachment(
    @Param('inquiryId') inquiryId: string,
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] POST /api/v1/inquiries/${inquiryId}/attachments`);
    return this.proxyService.proxyToInquiry(
      'POST',
      `/api/v1/inquiries/${inquiryId}/attachments`,
      body,
      { Authorization: authHeader },
    );
  }

  /**
   * Upload file and create attachment in one call
   * POST /api/v1/inquiries/:inquiryId/attachments/upload
   */
  @Post(':inquiryId/attachments/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upload file and create attachment in one call' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'inquiryId', description: 'Inquiry UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (images, PDF, documents, spreadsheets, text; max 10MB)',
        },
        message_id: {
          type: 'string',
          description: 'Message UUID this attachment belongs to',
        },
      },
      required: ['file', 'message_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded and attachment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file type, file too large, or missing message_id' })
  @ApiResponse({ status: 404, description: 'Inquiry or message not found' })
  async uploadAndCreateAttachment(
    @Param('inquiryId') inquiryId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const messageId = req.body?.message_id;
    if (!messageId) {
      throw new BadRequestException('message_id is required');
    }

    this.logger.log(`[BFF → Inquiry] POST /api/v1/inquiries/${inquiryId}/attachments/upload`);
    
    return this.proxyService.proxyFileUploadToInquiry(
      `/api/v1/inquiries/${inquiryId}/attachments/upload`,
      file,
      { Authorization: authHeader },
      { message_id: messageId },
    );
  }

  /**
   * Get attachments for inquiry (paginated)
   * GET /api/v1/inquiries/:inquiryId/attachments
   */
  @Get(':inquiryId/attachments')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List attachments for inquiry (paginated)' })
  @ApiParam({ name: 'inquiryId', description: 'Inquiry UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'Attachments retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inquiry not found' })
  async getAttachments(
    @Param('inquiryId') inquiryId: string,
    @Headers('authorization') authHeader: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    const queryString = queryParams.toString();
    const path = `/api/v1/inquiries/${inquiryId}/attachments${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Inquiry] GET ${path}`);
    return this.proxyService.proxyToInquiry(
      'GET',
      path,
      null,
      { Authorization: authHeader },
    );
  }
}

