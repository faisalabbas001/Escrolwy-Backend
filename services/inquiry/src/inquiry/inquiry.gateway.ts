import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InquiryService } from './inquiry.service';
import {
  InquiryWebSocketEvent,
  JoinInquiryDto,
  LeaveInquiryDto,
  SendMessageDto,
  TypingDto,
  MessageReceivedPayload,
  AttachmentUploadedPayload,
  UserPresencePayload,
  UserTypingPayload,
  InquiryUpdatedPayload,
  WebSocketErrorPayload,
} from './dto/websocket.dto';

/**
 * WebSocket Gateway for Inquiry Conversations
 *
 * Provides real-time communication for:
 * - Sending/receiving messages
 * - Typing indicators
 * - User presence (join/leave)
 * - Attachment upload notifications
 * - Inquiry status updates
 *
 * Uses Socket.IO rooms based on inquiry_id for message isolation
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: false,
  },
  namespace: '/inquiry',
  transports: ['websocket', 'polling'],
})
export class InquiryGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InquiryGateway.name);

  // Track connected users per inquiry room
  private readonly connectedUsers = new Map<
    string,
    Map<string, { socketId: string; userId: string; userRole: string; displayName?: string }>
  >();

  constructor(private readonly inquiryService: InquiryService) {}

  /**
   * Called when gateway is initialized
   */
  afterInit(server: Server) {
    this.logger.log('🔌 Inquiry WebSocket Gateway initialized');
  }

  /**
   * Called when a client connects
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Called when a client disconnects
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove user from all rooms they were in
    this.removeUserFromAllRooms(client.id);
  }

  /**
   * Join an inquiry conversation room
   * Only allows:
   * - Buyer of the escrow (user_id matches escrow.buyerId and role is 'buyer')
   * - Seller of the escrow (user_id matches escrow.sellerId and role is 'seller')
   * - Super admin (role is 'super-admin') - can join any inquiry
   * - Assigned admin (role is 'admin' and user_id matches inquiry.assigned_admin_id)
   */
  @SubscribeMessage(InquiryWebSocketEvent.JOIN_INQUIRY)
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleJoinInquiry(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinInquiryDto,
  ) {
    try {
      const roomId = this.getRoomId(data.inquiry_id);

      // Verify inquiry exists
      const inquiry = await this.inquiryService.getInquiryById(data.inquiry_id);
      if (!inquiry) {
        this.emitError(client, 'INQUIRY_NOT_FOUND', 'Inquiry not found');
        return;
      }

      // Validate user has access to this inquiry room
      const hasAccess = await this.inquiryService.validateUserAccess(
        data.inquiry_id,
        data.user_id,
        data.user_role,
      );

      if (!hasAccess) {
        this.emitError(
          client,
          'ACCESS_DENIED',
          'You do not have permission to join this inquiry room. Only the buyer, seller, super admin, or assigned admin can join.',
        );
        return;
      }

      // Join the Socket.IO room
      await client.join(roomId);

      // Track user in room
      this.addUserToRoom(data.inquiry_id, client.id, {
        userId: data.user_id,
        userRole: data.user_role,
      });

      this.logger.log(
        `User ${data.user_id} (${data.user_role}) joined inquiry room: ${data.inquiry_id}`,
      );

      // Notify others in the room
      const presencePayload: UserPresencePayload = {
        inquiry_id: data.inquiry_id,
        user_id: data.user_id,
        user_role: data.user_role,
        timestamp: new Date().toISOString(),
      };

      client.to(roomId).emit(InquiryWebSocketEvent.USER_JOINED, presencePayload);

      // Send acknowledgment to the joining user
      return {
        success: true,
        inquiry_id: data.inquiry_id,
        message: 'Joined inquiry conversation',
        participants: this.getRoomParticipants(data.inquiry_id),
      };
    } catch (error) {
      this.logger.error(`Error joining inquiry room: ${error}`);
      this.emitError(client, 'JOIN_FAILED', 'Failed to join inquiry conversation');
    }
  }

  /**
   * Leave an inquiry conversation room
   */
  @SubscribeMessage(InquiryWebSocketEvent.LEAVE_INQUIRY)
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleLeaveInquiry(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveInquiryDto,
  ) {
    try {
      const roomId = this.getRoomId(data.inquiry_id);

      // Get user info before removing
      const userInfo = this.getUserFromRoom(data.inquiry_id, client.id);

      // Leave the Socket.IO room
      await client.leave(roomId);

      // Remove user from tracking
      this.removeUserFromRoom(data.inquiry_id, client.id);

      this.logger.log(`User ${data.user_id} left inquiry room: ${data.inquiry_id}`);

      // Notify others in the room
      if (userInfo) {
        const presencePayload: UserPresencePayload = {
          inquiry_id: data.inquiry_id,
          user_id: data.user_id,
          user_role: userInfo.userRole as 'buyer' | 'seller' | 'admin',
          timestamp: new Date().toISOString(),
        };

        client.to(roomId).emit(InquiryWebSocketEvent.USER_LEFT, presencePayload);
      }

      return { success: true, message: 'Left inquiry conversation' };
    } catch (error) {
      this.logger.error(`Error leaving inquiry room: ${error}`);
      this.emitError(client, 'LEAVE_FAILED', 'Failed to leave inquiry conversation');
    }
  }

  /**
   * Send a message to an inquiry conversation
   */
  @SubscribeMessage(InquiryWebSocketEvent.SEND_MESSAGE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    try {
      // Persist message to database
      // Map WebSocket DTO (snake_case) to REST API DTO (camelCase)
      const message = await this.inquiryService.addMessage(data.inquiry_id, {
        senderId: data.sender_id,
        senderRole: data.sender_role,
        message: data.message,
      });

      // Broadcast to all users in the room (including sender)
      const messagePayload: MessageReceivedPayload = {
        id: message.id,
        inquiry_id: message.inquiry_id,
        sender_id: message.sender_id,
        sender_role: message.sender_role as 'buyer' | 'seller' | 'admin',
        message: message.message,
        created_at: message.created_at.toISOString(),
      };

      const roomId = this.getRoomId(data.inquiry_id);
      this.server.to(roomId).emit(InquiryWebSocketEvent.MESSAGE_RECEIVED, messagePayload);

      this.logger.log(`Message sent in inquiry ${data.inquiry_id} by ${data.sender_id}`);

      return { success: true, message: messagePayload };
    } catch (error: any) {
      this.logger.error(`Error sending message: ${error}`);
      this.emitError(client, 'MESSAGE_FAILED', error.message || 'Failed to send message');
    }
  }

  /**
   * Handle typing start indicator
   */
  @SubscribeMessage(InquiryWebSocketEvent.TYPING_START)
  @UsePipes(new ValidationPipe({ transform: true }))
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingDto,
  ) {
    const roomId = this.getRoomId(data.inquiry_id);

    const typingPayload: UserTypingPayload = {
      inquiry_id: data.inquiry_id,
      user_id: data.user_id,
      user_role: data.user_role,
      display_name: data.display_name,
      is_typing: true,
    };

    // Broadcast to others in the room (not the sender)
    client.to(roomId).emit(InquiryWebSocketEvent.USER_TYPING, typingPayload);
  }

  /**
   * Handle typing stop indicator
   */
  @SubscribeMessage(InquiryWebSocketEvent.TYPING_STOP)
  @UsePipes(new ValidationPipe({ transform: true }))
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingDto,
  ) {
    const roomId = this.getRoomId(data.inquiry_id);

    const typingPayload: UserTypingPayload = {
      inquiry_id: data.inquiry_id,
      user_id: data.user_id,
      user_role: data.user_role,
      display_name: data.display_name,
      is_typing: false,
    };

    // Broadcast to others in the room (not the sender)
    client.to(roomId).emit(InquiryWebSocketEvent.USER_TYPING, typingPayload);
  }

  // ========================================
  // PUBLIC METHODS FOR SERVICE/CONTROLLER USE
  // ========================================

  /**
   * Broadcast a new message to all users in an inquiry room
   * Called from InquiryService or InquiryController after HTTP message creation
   */
  broadcastMessage(payload: MessageReceivedPayload) {
    const roomId = this.getRoomId(payload.inquiry_id);
    this.server.to(roomId).emit(InquiryWebSocketEvent.MESSAGE_RECEIVED, payload);
    this.logger.debug(`Broadcasted message to room ${roomId}`);
  }

  /**
   * Broadcast an attachment upload to all users in an inquiry room
   * Called from InquiryController after HTTP attachment upload
   */
  broadcastAttachment(payload: AttachmentUploadedPayload) {
    const roomId = this.getRoomId(payload.inquiry_id);
    this.server.to(roomId).emit(InquiryWebSocketEvent.ATTACHMENT_UPLOADED, payload);
    this.logger.debug(`Broadcasted attachment to room ${roomId}`);
  }

  /**
   * Broadcast inquiry status update to all users in an inquiry room
   * Called when inquiry status changes (assigned, resolved, closed)
   */
  broadcastInquiryUpdate(payload: InquiryUpdatedPayload) {
    const roomId = this.getRoomId(payload.inquiry_id);
    this.server.to(roomId).emit(InquiryWebSocketEvent.INQUIRY_UPDATED, payload);
    this.logger.debug(`Broadcasted inquiry update to room ${roomId}`);
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Get room ID for an inquiry
   */
  private getRoomId(inquiryId: string): string {
    return `inquiry:${inquiryId}`;
  }

  /**
   * Add user to room tracking
   */
  private addUserToRoom(
    inquiryId: string,
    socketId: string,
    userInfo: { userId: string; userRole: string; displayName?: string },
  ) {
    if (!this.connectedUsers.has(inquiryId)) {
      this.connectedUsers.set(inquiryId, new Map());
    }

    this.connectedUsers.get(inquiryId)!.set(socketId, {
      socketId,
      ...userInfo,
    });
  }

  /**
   * Remove user from room tracking
   */
  private removeUserFromRoom(inquiryId: string, socketId: string) {
    const room = this.connectedUsers.get(inquiryId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.connectedUsers.delete(inquiryId);
      }
    }
  }

  /**
   * Get user info from room
   */
  private getUserFromRoom(inquiryId: string, socketId: string) {
    return this.connectedUsers.get(inquiryId)?.get(socketId);
  }

  /**
   * Remove user from all rooms (on disconnect)
   */
  private removeUserFromAllRooms(socketId: string) {
    for (const [inquiryId, room] of this.connectedUsers.entries()) {
      const userInfo = room.get(socketId);
      if (userInfo) {
        room.delete(socketId);

        // Notify others that user left
        const roomId = this.getRoomId(inquiryId);
        const presencePayload: UserPresencePayload = {
          inquiry_id: inquiryId,
          user_id: userInfo.userId,
          user_role: userInfo.userRole as 'buyer' | 'seller' | 'admin',
          timestamp: new Date().toISOString(),
        };
        this.server.to(roomId).emit(InquiryWebSocketEvent.USER_LEFT, presencePayload);

        if (room.size === 0) {
          this.connectedUsers.delete(inquiryId);
        }
      }
    }
  }

  /**
   * Get list of participants in a room
   */
  private getRoomParticipants(inquiryId: string) {
    const room = this.connectedUsers.get(inquiryId);
    if (!room) return [];

    return Array.from(room.values()).map((user) => ({
      user_id: user.userId,
      user_role: user.userRole,
      display_name: user.displayName,
    }));
  }

  /**
   * Emit error to client
   */
  private emitError(client: Socket, code: string, message: string, details?: any) {
    const errorPayload: WebSocketErrorPayload = {
      code,
      message,
      details,
    };
    client.emit(InquiryWebSocketEvent.ERROR, errorPayload);
  }
}

