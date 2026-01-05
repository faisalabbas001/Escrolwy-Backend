import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  DefaultValuePipe,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Headers,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Roles, Role, CurrentUser } from "@escrowly/auth-common";
import { InquiryService } from "./inquiry.service";
import { InquiryGateway } from "./inquiry.gateway";
import { S3Service } from "../upload";
import {
  CreateInquiryDto,
  CloseInquiryDto,
  CreateMessageDto,
  CreateAttachmentDto,
  AssignInquiryDto,
  ResolveInquiryDto,
  InquiryResponseDto,
  InquiryDetailResponseDto,
  InquiryListResponseDto,
  MessageResponseDto,
  MessageListResponseDto,
  AttachmentResponseDto,
  AttachmentListResponseDto,
  AdminInquiryListResponseDto,
  AdminInquiryDetailResponseDto,
  MessageReceivedPayload,
  AttachmentUploadedPayload,
  InquiryUpdatedPayload,
} from "./dto";

/**
 * Inquiry Controller
 *
 * REST API endpoints for inquiry management
 *
 * Routes:
 * - POST /api/v1/inquiries - Create inquiry
 * - GET /api/v1/inquiries/:inquiryId - Get inquiry
 * - GET /api/v1/inquiries/escrow/:escrowId - Get by escrow
 * - POST /api/v1/inquiries/:inquiryId/close - Close inquiry
 * - POST /api/v1/inquiries/:inquiryId/messages - Add message
 * - GET /api/v1/inquiries/:inquiryId/messages - List messages
 * - POST /api/v1/inquiries/:inquiryId/attachments - Add attachment
 * - GET /api/v1/inquiries/:inquiryId/attachments - List attachments
 * - GET /api/v1/admin/inquiries - List inquiries (admin)
 * - GET /api/v1/admin/inquiries/:id - Get inquiry detail (admin)
 * - POST /api/v1/admin/inquiries/:id/assign - Assign admin
 * - POST /api/v1/admin/inquiries/:id/resolve - Resolve inquiry
 */
@ApiTags("inquiries")
@Controller({
  path: "inquiries",
  version: "1",
})
export class InquiryController {
  private readonly logger = new Logger(InquiryController.name);

  constructor(
    private readonly inquiryService: InquiryService,
    private readonly inquiryGateway: InquiryGateway,
    private readonly s3Service: S3Service,
  ) {}

  // ========================================
  // USER/BUYER/SELLER ENDPOINTS
  // ========================================

  /**
   * Create a new inquiry
   * POST /api/v1/inquiries
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Create a new inquiry" })
  @ApiResponse({
    status: 201,
    description: "Inquiry created successfully",
    type: InquiryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation error",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 409,
    description: "Inquiry already exists for this escrow",
  })
  async createInquiry(
    @Body() dto: CreateInquiryDto,
    @Headers("authorization") authHeader?: string
  ): Promise<InquiryResponseDto> {
    this.logger.log(`Creating inquiry for escrow: ${dto.escrow_id}`);
    return this.inquiryService.createInquiry(dto, authHeader);
  }

  /**
   * Get inquiry by ID
   * GET /api/v1/inquiries/:inquiryId
   */
  @Get(":inquiryId")
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Get inquiry by ID" })
  @ApiParam({
    name: "inquiryId",
    description: "Inquiry UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Inquiry retrieved successfully",
    type: InquiryDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async getInquiry(
    @Param("inquiryId") inquiryId: string
  ): Promise<InquiryDetailResponseDto> {
    this.logger.log(`Fetching inquiry: ${inquiryId}`);
    return this.inquiryService.getInquiryById(inquiryId);
  }

  /**
   * Get inquiry by escrow ID
   * GET /api/v1/inquiries/escrow/:escrowId
   */
  @Get("escrow/:escrowId")
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Get inquiry for escrow" })
  @ApiParam({
    name: "escrowId",
    description: "Escrow ID",
  })
  @ApiResponse({
    status: 200,
    description: "Inquiry retrieved successfully",
    type: InquiryDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found for this escrow",
  })
  async getInquiryByEscrow(
    @Param("escrowId") escrowId: string
  ): Promise<InquiryDetailResponseDto> {
    this.logger.log(`Fetching inquiry for escrow: ${escrowId}`);
    return this.inquiryService.getInquiryByEscrowId(escrowId);
  }

  /**
   * Close inquiry
   * POST /api/v1/inquiries/:inquiryId/close
   */
  @Post(":inquiryId/close")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Close inquiry" })
  @ApiParam({
    name: "inquiryId",
    description: "Inquiry UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Inquiry closed successfully",
    type: InquiryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid operation",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async closeInquiry(
    @Param("inquiryId") inquiryId: string,
    @Body() dto: CloseInquiryDto
  ): Promise<InquiryResponseDto> {
    this.logger.log(`Closing inquiry: ${inquiryId}`);
    const inquiry = await this.inquiryService.closeInquiry(inquiryId, dto);

    // Broadcast inquiry update to all users in the inquiry room via WebSocket
    const updatePayload: InquiryUpdatedPayload = {
      inquiry_id: inquiry.id,
      status: inquiry.status,
      updated_at: inquiry.updated_at.toISOString(),
      update_type: "closed",
    };
    this.inquiryGateway.broadcastInquiryUpdate(updatePayload);

    return inquiry;
  }

  // ========================================
  // MESSAGE ENDPOINTS
  // ========================================

  /**
   * Add message to inquiry
   * POST /api/v1/inquiries/:inquiryId/messages
   */
  @Post(":inquiryId/messages")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Add message to inquiry" })
  @ApiParam({
    name: "inquiryId",
    description: "Inquiry UUID",
  })
  @ApiResponse({
    status: 201,
    description: "Message added successfully",
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request or inquiry closed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async addMessage(
    @Param("inquiryId") inquiryId: string,
    @Body() dto: CreateMessageDto
  ): Promise<MessageResponseDto> {
    this.logger.log(`Adding message to inquiry: ${inquiryId}`);
    const message = await this.inquiryService.addMessage(inquiryId, dto);

    // Broadcast message to all users in the inquiry room via WebSocket
    const messagePayload: MessageReceivedPayload = {
      id: message.id,
      inquiry_id: message.inquiry_id,
      sender_id: message.sender_id,
      sender_role: message.sender_role as "buyer" | "seller" | "admin",
      message: message.message,
      created_at: message.created_at.toISOString(),
    };
    this.inquiryGateway.broadcastMessage(messagePayload);

    return message;
  }

  /**
   * Get messages for inquiry (paginated)
   * GET /api/v1/inquiries/:inquiryId/messages
   */
  @Get(":inquiryId/messages")
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "List messages for inquiry (paginated)" })
  @ApiParam({
    name: "inquiryId",
    description: "Inquiry UUID",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
  })
  @ApiResponse({
    status: 200,
    description: "Messages retrieved successfully",
    type: MessageListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async getMessages(
    @Param("inquiryId") inquiryId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number
  ): Promise<MessageListResponseDto> {
    this.logger.log(`Fetching messages for inquiry: ${inquiryId}`);
    return this.inquiryService.getMessages(inquiryId, page, limit);
  }

  // ========================================
  // ATTACHMENT ENDPOINTS
  // ========================================

  /**
   * Add attachment to inquiry
   * POST /api/v1/inquiries/:inquiryId/attachments
   */
  @Post(":inquiryId/attachments")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Add attachment to inquiry" })
  @ApiParam({
    name: "inquiryId",
    description: "Inquiry UUID",
  })
  @ApiResponse({
    status: 201,
    description: "Attachment added successfully",
    type: AttachmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry or message not found",
  })
  async addAttachment(
    @Param("inquiryId") inquiryId: string,
    @Body() dto: CreateAttachmentDto
  ): Promise<AttachmentResponseDto> {
    this.logger.log(`Adding attachment to inquiry: ${inquiryId}`);
    const attachment = await this.inquiryService.addAttachment(inquiryId, dto);

    // Broadcast attachment to all users in the inquiry room via WebSocket
    const attachmentPayload: AttachmentUploadedPayload = {
      id: attachment.id,
      inquiry_id: attachment.inquiry_id,
      message_id: attachment.message_id,
      file_url: attachment.file_url,
      file_type: attachment.file_type,
      uploaded_by: dto.message_id, // Will be replaced with actual user ID from context
      created_at: attachment.created_at.toISOString(),
    };
    this.inquiryGateway.broadcastAttachment(attachmentPayload);

    return attachment;
  }

  /**
   * Upload file and create attachment in one call
   * POST /api/v1/inquiries/:inquiryId/attachments/upload
   *
   * This endpoint:
   * 1. Uploads the file to S3
   * 2. Creates an attachment record in the database
   * 3. Returns the created attachment
   */
  @Post(":inquiryId/attachments/upload")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  @ApiBearerAuth("access_token")
  @ApiOperation({
    summary: "Upload file and create attachment in one call",
    description:
      "Uploads a file to S3 and creates an attachment record linked to the specified message. Supported file types: images (JPEG, PNG, WebP, GIF), documents (PDF, DOC, DOCX), spreadsheets (XLS, XLSX), text files. Max file size: 10MB.",
  })
  @ApiParam({
    name: "inquiryId",
    description: "Inquiry UUID",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description:
            "File to upload (images, PDF, documents, spreadsheets, text; max 10MB)",
        },
        message_id: {
          type: "string",
          description: "Message UUID this attachment belongs to",
          example: "550e8400-e29b-41d4-a716-446655440000",
        },
      },
      required: ["file", "message_id"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded and attachment created successfully",
    type: AttachmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid file type, file too large, or missing message_id",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry or message not found",
  })
  async uploadAndCreateAttachment(
    @Param("inquiryId") inquiryId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("message_id") messageId: string
  ): Promise<AttachmentResponseDto> {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    if (!messageId) {
      throw new BadRequestException("message_id is required");
    }

    this.logger.log(
      `Uploading file and creating attachment for inquiry: ${inquiryId}`
    );

    // Upload file to S3 (organized by inquiry ID)
    const folder = `escrowly-inquiries/${inquiryId}`;
    const uploadResult = await this.s3Service.uploadFile(file, folder);

    // Create attachment record in database
    const attachment = await this.inquiryService.addAttachment(inquiryId, {
      message_id: messageId,
      file_url: uploadResult.url,
      file_type: uploadResult.fileType,
    });

    // Broadcast attachment to all users in the inquiry room via WebSocket
    const attachmentPayload: AttachmentUploadedPayload = {
      id: attachment.id,
      inquiry_id: attachment.inquiry_id,
      message_id: attachment.message_id,
      file_url: attachment.file_url,
      file_type: attachment.file_type,
      uploaded_by: messageId, // Will be replaced with actual user ID from auth context
      created_at: attachment.created_at.toISOString(),
    };
    this.inquiryGateway.broadcastAttachment(attachmentPayload);

    return attachment;
  }

  /**
   * Get attachments for inquiry (paginated)
   * GET /api/v1/inquiries/:inquiryId/attachments
   */
  @Get(":inquiryId/attachments")
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "List attachments for inquiry (paginated)" })
  @ApiParam({
    name: "inquiryId",
    description: "Inquiry UUID",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
  })
  @ApiResponse({
    status: 200,
    description: "Attachments retrieved successfully",
    type: AttachmentListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
  })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async getAttachments(
    @Param("inquiryId") inquiryId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number
  ): Promise<AttachmentListResponseDto> {
    this.logger.log(`Fetching attachments for inquiry: ${inquiryId}`);
    return this.inquiryService.getAttachments(inquiryId, page, limit);
  }

  // ========================================
  // ADMIN ENDPOINTS
  // ========================================
  // NOTE: Admin endpoints have been moved to admin-inquiry.controller.ts
  // to ensure correct routing at /api/v1/admin/inquiries
}
