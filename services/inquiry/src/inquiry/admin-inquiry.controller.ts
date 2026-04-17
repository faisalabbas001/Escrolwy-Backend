import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Roles, Role, CurrentUser } from "@escrowly/auth-common";
import { InquiryService } from "./inquiry.service";
import { InquiryGateway } from "./inquiry.gateway";
import {
  AssignInquiryDto,
  ResolveInquiryDto,
  InquiryResponseDto,
  AdminInquiryListResponseDto,
  AdminInquiryDetailResponseDto,
  InquiryUpdatedPayload,
} from "./dto";

/**
 * Admin Inquiry Controller
 *
 * Admin-only endpoints for inquiry management
 *
 * Routes:
 * - GET /api/v1/admin/inquiries - List inquiries (admin)
 * - GET /api/v1/admin/inquiries/:id - Get inquiry detail (admin)
 * - POST /api/v1/admin/inquiries/:id/assign - Assign admin
 * - POST /api/v1/admin/inquiries/:id/resolve - Resolve inquiry
 */
@ApiTags("admin/inquiries")
@Controller({
  path: "admin/inquiries",
  version: "1",
})
export class AdminInquiryController {
  private readonly logger = new Logger(AdminInquiryController.name);

  constructor(
    private readonly inquiryService: InquiryService,
    private readonly inquiryGateway: InquiryGateway,
  ) {}

  /**
   * List inquiries (admin)
   * GET /api/v1/admin/inquiries
   */
  @Get()
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "List inquiries (admin only)" })
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
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["open", "resolved", "closed"],
    description: "Filter by status",
  })
  @ApiQuery({
    name: "assignedAdminId",
    required: false,
    type: String,
    description: "Filter by assigned admin",
  })
  @ApiResponse({
    status: 200,
    description: "Inquiries list retrieved successfully",
    type: AdminInquiryListResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized - JWT token required" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  async listInquiriesAdmin(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status?: string,
    @Query("assignedAdminId") assignedAdminId?: string
  ): Promise<AdminInquiryListResponseDto> {
    this.logger.log("Fetching inquiries list for admin");
    return this.inquiryService.listInquiries(
      page,
      limit,
      status,
      assignedAdminId
    );
  }

  /**
   * Get inquiry detail (admin)
   * GET /api/v1/admin/inquiries/:id
   */
  @Get(":id")
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Get inquiry full detail (admin only)" })
  @ApiParam({
    name: "id",
    description: "Inquiry UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Inquiry detail retrieved successfully",
    type: AdminInquiryDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async getInquiryDetailAdmin(
    @Param("id") inquiryId: string
  ): Promise<AdminInquiryDetailResponseDto> {
    this.logger.log(`Fetching inquiry detail for admin: ${inquiryId}`);
    return this.inquiryService.getInquiryDetailAdmin(inquiryId);
  }

  /**
   * Assign inquiry to admin
   * POST /api/v1/admin/inquiries/:id/assign
   */
  @Post(":id/assign")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Assign inquiry to admin" })
  @ApiParam({
    name: "id",
    description: "Inquiry UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Inquiry assigned successfully",
    type: InquiryResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async assignInquiry(
    @Param("id") inquiryId: string,
    @Body() dto: AssignInquiryDto,
    @CurrentUser("id") adminId: string
  ): Promise<InquiryResponseDto> {
    this.logger.log(`Assigning inquiry ${inquiryId} to admin ${adminId}`);
    const inquiry = await this.inquiryService.assignInquiry(inquiryId, dto, adminId);

    // Broadcast inquiry update to all users in the inquiry room via WebSocket
    const updatePayload: InquiryUpdatedPayload = {
      inquiry_id: inquiry.id,
      status: inquiry.status,
      assigned_admin_id: inquiry.assigned_admin_id || undefined,
      updated_at: inquiry.updated_at.toISOString(),
      update_type: "admin_assigned",
    };
    this.inquiryGateway.broadcastInquiryUpdate(updatePayload);

    return inquiry;
  }

  /**
   * Resolve inquiry (admin)
   * POST /api/v1/admin/inquiries/:id/resolve
   */
  @Post(":id/resolve")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPER_ADMIN, Role.STAFF_WEBSITE)
  @ApiBearerAuth("access_token")
  @ApiOperation({ summary: "Resolve inquiry as admin" })
  @ApiParam({
    name: "id",
    description: "Inquiry UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Inquiry resolved successfully",
    type: InquiryResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  @ApiResponse({
    status: 404,
    description: "Inquiry not found",
  })
  async resolveInquiry(
    @Param("id") inquiryId: string,
    @Body() dto: ResolveInquiryDto,
    @CurrentUser("id") adminId: string
  ): Promise<InquiryResponseDto> {
    this.logger.log(`Resolving inquiry: ${inquiryId} by admin ${adminId}`);
    const inquiry = await this.inquiryService.resolveInquiry(inquiryId, dto, adminId);

    // Broadcast inquiry update to all users in the inquiry room via WebSocket
    const updatePayload: InquiryUpdatedPayload = {
      inquiry_id: inquiry.id,
      status: inquiry.status,
      updated_at: inquiry.updated_at.toISOString(),
      update_type: "resolved",
    };
    this.inquiryGateway.broadcastInquiryUpdate(updatePayload);

    return inquiry;
  }
}
