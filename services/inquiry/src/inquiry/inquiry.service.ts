import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma';
import { InquiryStatus, MessageSenderRole } from '../../generated/prisma';
import {
  CreateInquiryDto,
  CloseInquiryDto,
  CreateMessageDto,
  CreateAttachmentDto,
  AssignInquiryDto,
  ResolveInquiryDto,
} from './dto';
import { InquiryEventProducer } from '../kafka';
import type {
  InquiryCreatedPayload,
  InquiryClosedPayload,
  InquiryResolvedPayload,
  InquiryAssignedPayload,
  InquiryMessageAddedPayload,
  InquiryAttachmentUploadedPayload,
} from '@escrowly/kafka-core';

/**
 * Inquiry Service
 *
 * Handles inquiry management:
 * - Create inquiries
 * - Manage messages
 * - Manage attachments
 * - Admin operations (assign, resolve)
 *
 * Uses @escrowly/kafka-core and @escrowly/kafka-publisher for
 * production-ready Kafka integration with Transactional Outbox Pattern.
 */
@Injectable()
export class InquiryService {
  private readonly logger = new Logger(InquiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventProducer: InquiryEventProducer,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new inquiry
   * One inquiry per escrow (unique constraint)
   * Fetches and stores buyerId/sellerId from escrow service to reduce future auth dependencies
   */
  async createInquiry(dto: CreateInquiryDto, authHeader?: string) {
    this.logger.debug(`Creating inquiry for escrow: ${dto.escrow_id}`);

    // Check if inquiry already exists for this escrow
    const existingInquiry = await this.prisma.inquiries.findUnique({
      where: { escrow_id: dto.escrow_id },
    });

    if (existingInquiry) {
      throw new ConflictException(
        `Inquiry already exists for escrow ${dto.escrow_id}`,
      );
    }

    // Fetch buyer and seller IDs from escrow service (only once during creation)
    let buyerId: string | null = null;
    let sellerId: string | null = null;

    if (authHeader) {
      try {
        const escrowServiceUrl = this.configService.get<string>(
          'ESCROW_SERVICE_URL',
          'http://localhost:3004',
        );

        this.logger.debug(
          `Fetching escrow metadata for buyer/seller IDs: ${dto.escrow_id} from ${escrowServiceUrl}`,
        );

        const response = await firstValueFrom(
          this.httpService.get(
            `${escrowServiceUrl}/api/v1/escrows/${dto.escrow_id}`,
            { headers: { Authorization: authHeader } },
          ),
        );

        const escrow = response.data;
        buyerId = escrow.buyerId || null;
        sellerId = escrow.sellerId || null;

        this.logger.debug(
          `Fetched escrow metadata - Buyer: ${buyerId || 'NOT_FOUND'}, Seller: ${sellerId || 'NOT_FOUND'}`,
        );
      } catch (error: any) {
        this.logger.warn(
          `Failed to fetch escrow metadata for ${dto.escrow_id}: ${error.message}. Inquiry will be created without buyer/seller IDs.`,
        );
        // Continue without buyer/seller IDs - they can be populated later if needed
      }
    } else {
      this.logger.warn(
        `No Authorization header provided - cannot fetch buyer/seller IDs. Inquiry will be created without metadata.`,
      );
    }

    // Create inquiry (and optional initial message in transaction)
    const inquiry = await this.prisma.$transaction(async (tx) => {
      const newInquiry = await tx.inquiries.create({
        data: {
          escrow_id: dto.escrow_id,
          created_by: dto.created_by,
          buyer_id: buyerId,
          seller_id: sellerId,
          status: 'open',
        },
      });

      // Add initial message if provided
      if (dto.initial_message) {
        await tx.inquiry_messages.create({
          data: {
            inquiry_id: newInquiry.id,
            sender_id: dto.created_by,
            sender_role: 'buyer', // First message is from creator
            message: dto.initial_message,
          },
        });
      }

      return newInquiry;
    });

    // Emit inquiry.created event via outbox (fire-and-forget)
    const eventPayload: InquiryCreatedPayload = {
      inquiry: {
        id: inquiry.id,
        escrowId: inquiry.escrow_id,
        createdBy: inquiry.created_by,
        assignedAdminId: inquiry.assigned_admin_id || undefined,
        status: inquiry.status,
        createdAt: inquiry.created_at.toISOString(),
        updatedAt: inquiry.updated_at.toISOString(),
      },
      initialMessage: dto.initial_message,
      createdBy: dto.created_by,
    };
    await this.eventProducer.inquiryCreated(eventPayload);

    return inquiry;
  }

  /**
   * Get inquiry by ID
   */
  async getInquiryById(inquiryId: string) {
    this.logger.debug(`Fetching inquiry: ${inquiryId}`);

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
      include: {
        messages: {
          orderBy: { created_at: "desc" },
          take: 5, // Last 5 messages
        },
        attachments: {
          orderBy: { created_at: "desc" },
          take: 10,
        },
      },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    return inquiry;
  }

  /**
   * Validate if a user can access an inquiry room
   * Returns true if user is:
   * - The buyer of the escrow (and role is 'buyer')
   * - The seller of the escrow (and role is 'seller')
   * - The super admin (role is 'super-admin') – can always join
   * - The assigned admin (role is 'admin' and user_id matches assigned_admin_id)
   */
  async validateUserAccess(
    inquiryId: string,
    userId: string,
    userRole: 'buyer' | 'seller' | 'admin' | 'super-admin',
  ): Promise<boolean> {
    this.logger.debug(
      `Validating access for user ${userId} (${userRole}) to inquiry ${inquiryId}`,
    );

    // Get inquiry to find escrow_id and assigned_admin_id
    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      return false;
    }

    // Super admin can always join any inquiry room
    if (userRole === 'super-admin') {
      return true;
    }

    // Regular admins can only join if they are assigned to the inquiry
    if (userRole === 'admin') {
      // Must be the assigned admin
      if (!inquiry.assigned_admin_id) {
        return false;
      }
      return userId === inquiry.assigned_admin_id;
    }

    // For buyer/seller, check against stored buyer_id/seller_id (no escrow service call needed)
    if (userRole === 'buyer') {
      if (!inquiry.buyer_id) {
        this.logger.warn(
          `Missing buyer_id for inquiry ${inquiryId} - cannot validate buyer access`,
        );
        return false; // Deny access if metadata is missing
      }
      return inquiry.buyer_id === userId;
    }

    if (userRole === 'seller') {
      if (!inquiry.seller_id) {
        this.logger.warn(
          `Missing seller_id for inquiry ${inquiryId} - cannot validate seller access`,
        );
        return false; // Deny access if metadata is missing
      }
      return inquiry.seller_id === userId;
    }

    return false;
  }

  /**
   * Get inquiry by escrow ID
   */
  async getInquiryByEscrowId(escrowId: string) {
    this.logger.debug(`Fetching inquiry for escrow: ${escrowId}`);

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { escrow_id: escrowId },
      include: {
        messages: {
          orderBy: { created_at: "desc" },
        },
        attachments: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry for escrow ${escrowId} not found`);
    }

    return inquiry;
  }

  /**
   * Close inquiry (user operation)
   */
  async closeInquiry(
    inquiryId: string,
    dto: CloseInquiryDto,
    closedBy?: string,
  ) {
    this.logger.debug(
      `Closing inquiry ${inquiryId} with status: ${dto.status}`,
    );

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    if (inquiry.status === 'closed') {
      throw new BadRequestException('Inquiry is already closed');
    }

    const updated = await this.prisma.inquiries.update({
      where: { id: inquiryId },
      data: { status: dto.status as InquiryStatus },
    });

    // Emit inquiry.closed event via outbox (fire-and-forget)
    const eventPayload: InquiryClosedPayload = {
      inquiryId: updated.id,
      escrowId: updated.escrow_id,
      status: 'closed',
      closedBy: closedBy || inquiry.created_by,
      note: dto.note,
      closedAt: new Date().toISOString(),
    };
    await this.eventProducer.inquiryClosed(eventPayload);

    return updated;
  }

  /**
   * Get participant IDs for an inquiry (buyer, seller, assigned admin)
   * Used to determine who should receive notifications
   * 
   * Uses stored buyer_id/seller_id from database to avoid escrow service calls.
   * Falls back to inquiry creator only if metadata is missing (for backward compatibility).
   * 
   * @param inquiry - Inquiry object with buyer_id, seller_id, created_by, assigned_admin_id
   */
  private async getInquiryParticipantIds(
    inquiry: { 
      escrow_id: string; 
      buyer_id: string | null;
      seller_id: string | null;
      created_by: string; 
      assigned_admin_id: string | null;
    },
  ): Promise<string[]> {
    const participants: string[] = [];

    // Use stored buyer_id and seller_id (preferred method - no auth dependency)
    if (inquiry.buyer_id) {
      participants.push(inquiry.buyer_id);
      this.logger.debug(`Added buyer ID from stored metadata: ${inquiry.buyer_id}`);
    }
    if (inquiry.seller_id) {
      participants.push(inquiry.seller_id);
      this.logger.debug(`Added seller ID from stored metadata: ${inquiry.seller_id}`);
    }

    // If both buyer_id and seller_id are stored, we're done (no escrow service call needed)
    if (inquiry.buyer_id && inquiry.seller_id) {
      this.logger.debug(
        `Found ${participants.length} participant IDs from stored metadata for inquiry ${inquiry.escrow_id}`,
      );
    } else {
      // Fallback: If metadata is missing (backward compatibility for old inquiries)
      this.logger.warn(
        `Missing buyer_id or seller_id for inquiry ${inquiry.escrow_id}. This may be an old inquiry created before metadata storage was implemented.`,
      );
      
      // Fallback to inquiry creator if metadata is completely missing
      if (!inquiry.buyer_id && !inquiry.seller_id && inquiry.created_by) {
        participants.push(inquiry.created_by);
        this.logger.debug(`Added inquiry creator as fallback participant: ${inquiry.created_by}`);
      }
    }

    // Add assigned admin if exists (always add, regardless of metadata availability)
    if (inquiry.assigned_admin_id) {
      participants.push(inquiry.assigned_admin_id);
      this.logger.debug(`Added assigned admin ID: ${inquiry.assigned_admin_id}`);
    }

    this.logger.debug(
      `Total ${participants.length} participant IDs for inquiry ${inquiry.escrow_id}`,
    );

    return participants;
  }

  /**
   * Add message to inquiry
   */
  async addMessage(inquiryId: string, dto: CreateMessageDto) {
    this.logger.debug(`Adding message to inquiry: ${inquiryId}`);

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    if (inquiry.status === 'closed') {
      throw new BadRequestException('Cannot add message to closed inquiry');
    }

    const message = await this.prisma.inquiry_messages.create({
      data: {
        inquiry_id: inquiryId,
        sender_id: dto.senderId,
        sender_role: dto.senderRole as MessageSenderRole,
        message: dto.message,
      },
    });

    // Get all participant IDs (buyer, seller, assigned admin)
    // Uses stored buyer_id/seller_id - no escrow service call needed
    const allParticipants = await this.getInquiryParticipantIds({
      escrow_id: inquiry.escrow_id,
      buyer_id: inquiry.buyer_id,
      seller_id: inquiry.seller_id,
      created_by: inquiry.created_by,
      assigned_admin_id: inquiry.assigned_admin_id,
    });

    // Exclude sender from recipient list
    const recipientIds = allParticipants.filter(
      (id) => id !== dto.senderId,
    );

    this.logger.debug(
      `Message added - Sender: ${dto.senderId}, Recipients: [${recipientIds.join(', ')}]`,
    );

    // Emit inquiry.message.added event via outbox (fire-and-forget)
    const eventPayload: InquiryMessageAddedPayload = {
      messageId: message.id,
      inquiryId: inquiry.id,
      escrowId: inquiry.escrow_id,
      senderId: dto.senderId,
      senderRole: dto.senderRole as 'buyer' | 'seller' | 'admin',
      message: dto.message,
      createdAt: message.created_at.toISOString(),
      recipientIds,
    };
    
    this.logger.debug(
      `Publishing inquiry.message.added event with recipientIds: [${recipientIds.join(', ')}]`,
    );
    await this.eventProducer.messageAdded(eventPayload);

    return message;
  }

  /**
   * Get messages for inquiry (paginated)
   */
  async getMessages(inquiryId: string, page: number = 1, limit: number = 20) {
    this.logger.debug(`Fetching messages for inquiry: ${inquiryId}`);

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.inquiry_messages.findMany({
        where: { inquiry_id: inquiryId },
        skip,
        take: limit,
        orderBy: { created_at: "asc" },
      }),
      this.prisma.inquiry_messages.count({
        where: { inquiry_id: inquiryId },
      }),
    ]);

    return {
      data: messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Add attachment to inquiry
   */
  async addAttachment(
    inquiryId: string,
    dto: CreateAttachmentDto,
    uploadedBy?: string,
  ) {
    this.logger.debug(`Adding attachment to inquiry: ${inquiryId}`);

    // Verify inquiry exists
    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    // Verify message exists
    const message = await this.prisma.inquiry_messages.findUnique({
      where: { id: dto.message_id },
    });

    if (!message) {
      throw new NotFoundException(`Message ${dto.message_id} not found`);
    }

    if (message.inquiry_id !== inquiryId) {
      throw new BadRequestException('Message does not belong to this inquiry');
    }

    const attachment = await this.prisma.inquiry_attachments.create({
      data: {
        inquiry_id: inquiryId,
        message_id: dto.message_id,
        file_url: dto.file_url,
        file_type: dto.file_type,
      },
    });

    // Emit inquiry.attachment.uploaded event via outbox (fire-and-forget)
    const eventPayload: InquiryAttachmentUploadedPayload = {
      attachmentId: attachment.id,
      inquiryId: inquiry.id,
      escrowId: inquiry.escrow_id,
      messageId: dto.message_id,
      fileUrl: dto.file_url,
      fileType: dto.file_type,
      uploadedBy: uploadedBy || message.sender_id,
      createdAt: attachment.created_at.toISOString(),
    };
    await this.eventProducer.attachmentUploaded(eventPayload);

    return attachment;
  }

  /**
   * Get attachments for inquiry (paginated)
   */
  async getAttachments(
    inquiryId: string,
    page: number = 1,
    limit: number = 20
  ) {
    this.logger.debug(`Fetching attachments for inquiry: ${inquiryId}`);

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    const skip = (page - 1) * limit;

    const [attachments, total] = await Promise.all([
      this.prisma.inquiry_attachments.findMany({
        where: { inquiry_id: inquiryId },
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      this.prisma.inquiry_attachments.count({
        where: { inquiry_id: inquiryId },
      }),
    ]);

    return {
      data: attachments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ========================================
  // ADMIN OPERATIONS
  // ========================================

  /**
   * List/filter inquiries (admin)
   */
  async listInquiries(
    page: number = 1,
    limit: number = 20,
    status?: string,
    assignedAdminId?: string
  ) {
    this.logger.debug("Fetching inquiries list for admin");

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (assignedAdminId) {
      where.assigned_admin_id = assignedAdminId;
    }

    const [inquiries, total] = await Promise.all([
      this.prisma.inquiries.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          messages: {
            orderBy: { created_at: "desc" },
            take: 3,
          },
          attachments: {
            orderBy: { created_at: "desc" },
            take: 5,
          },
        },
      }),
      this.prisma.inquiries.count({ where }),
    ]);

    // Add counts
    const data = inquiries.map((inq) => ({
      ...inq,
      message_count: inq.messages.length,
      attachment_count: inq.attachments.length,
      latest_messages: inq.messages,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get full inquiry detail (admin)
   */
  async getInquiryDetailAdmin(inquiryId: string) {
    this.logger.debug(`Fetching full inquiry detail for admin: ${inquiryId}`);

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
      include: {
        messages: {
          orderBy: { created_at: "desc" },
        },
        attachments: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    return {
      ...inquiry,
      message_count: inquiry.messages.length,
      attachment_count: inquiry.attachments.length,
    };
  }

  /**
   * Assign inquiry to admin
   */
  async assignInquiry(
    inquiryId: string,
    dto: AssignInquiryDto,
    assignedBy: string,
  ) {
    this.logger.debug(
      `Assigning inquiry ${inquiryId} to admin ${dto.admin_id}`,
    );

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    const updated = await this.prisma.inquiries.update({
      where: { id: inquiryId },
      data: { assigned_admin_id: dto.admin_id },
    });

    // Emit inquiry.assigned event via outbox (fire-and-forget)
    const eventPayload: InquiryAssignedPayload = {
      inquiryId: updated.id,
      escrowId: updated.escrow_id,
      adminId: dto.admin_id,
      assignedBy: assignedBy,
      assignedAt: new Date().toISOString(),
    };
    await this.eventProducer.inquiryAssigned(eventPayload);

    return updated;
  }

  /**
   * Resolve inquiry (admin)
   */
  async resolveInquiry(
    inquiryId: string,
    dto: ResolveInquiryDto,
    resolvedBy: string,
  ) {
    this.logger.debug(`Resolving inquiry ${inquiryId}`);

    const inquiry = await this.prisma.inquiries.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry ${inquiryId} not found`);
    }

    // Add resolution note as final message from admin
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update inquiry status to closed
      const updatedInquiry = await tx.inquiries.update({
        where: { id: inquiryId },
        data: { status: 'closed' },
      });

      // Add resolution note as message (if provided)
      if (dto.resolution_note) {
        await tx.inquiry_messages.create({
          data: {
            inquiry_id: inquiryId,
            sender_id: resolvedBy || 'system', // System user for resolution notes
            sender_role: 'admin',
            message: `${dto.resolution_note}`,
          },
        });
      }

      return updatedInquiry;
    });

    // Get buyer and seller IDs for notification
    // Use stored buyer_id/seller_id - no escrow service call needed
    const buyerId = updated.buyer_id || "";
    const sellerId = updated.seller_id || "";

    if (!buyerId || !sellerId) {
      this.logger.warn(
        `Missing buyer_id or seller_id for inquiry ${updated.id}. This may be an old inquiry created before metadata storage was implemented.`,
      );
    } else {
      this.logger.debug(
        `Inquiry resolved - Buyer: ${buyerId}, Seller: ${sellerId}, Resolved by: ${resolvedBy || inquiry.assigned_admin_id || 'system'}`,
      );
    }

    // Emit inquiry.resolved event via outbox (fire-and-forget)
    const eventPayload: InquiryResolvedPayload = {
      inquiryId: updated.id,
      escrowId: updated.escrow_id,
      status: 'closed',
      resolvedBy: resolvedBy,
      resolutionType: dto.status, // "Refund to Buyer", "Release to Seller", or "Split Funds"
      resolutionNote: dto.resolution_note,
      resolvedAt: new Date().toISOString(),
      buyerId, // ✅ Include buyer ID for notifications (empty string if not found)
      sellerId, // ✅ Include seller ID for notifications (empty string if not found)
    };
    await this.eventProducer.inquiryResolved(eventPayload);

    return updated;
  }
}
