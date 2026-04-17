import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';

/**
 * WebSocket Event Types for Inquiry Conversations
 */
export enum InquiryWebSocketEvent {
  // Client -> Server events
  JOIN_INQUIRY = 'join_inquiry',
  LEAVE_INQUIRY = 'leave_inquiry',
  SEND_MESSAGE = 'send_message',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',

  // Server -> Client events
  MESSAGE_RECEIVED = 'message_received',
  ATTACHMENT_UPLOADED = 'attachment_uploaded',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_TYPING = 'user_typing',
  INQUIRY_UPDATED = 'inquiry_updated',
  ERROR = 'error',
}

/**
 * DTO for joining an inquiry room
 */
export class JoinInquiryDto {
  @IsUUID()
  inquiry_id!: string;

  @IsUUID()
  user_id!: string;

  @IsEnum(['buyer', 'seller', 'admin', 'super-admin'])
  user_role!: 'buyer' | 'seller' | 'admin' | 'super-admin';
}

/**
 * DTO for leaving an inquiry room
 */
export class LeaveInquiryDto {
  @IsUUID()
  inquiry_id!: string;

  @IsUUID()
  user_id!: string;
}

/**
 * DTO for sending a message via WebSocket
 */
export class SendMessageDto {
  @IsUUID()
  inquiry_id!: string;

  @IsUUID()
  sender_id!: string;

  @IsEnum(['buyer', 'seller', 'admin'])
  sender_role!: 'buyer' | 'seller' | 'admin';

  @IsString()
  message!: string;
}

/**
 * DTO for typing indicator
 */
export class TypingDto {
  @IsUUID()
  inquiry_id!: string;

  @IsUUID()
  user_id!: string;

  @IsEnum(['buyer', 'seller', 'admin', 'super-admin'])
  user_role!: 'buyer' | 'seller' | 'admin' | 'super-admin';

  @IsOptional()
  @IsString()
  display_name?: string;
}

/**
 * Event payload for new message broadcast
 */
export interface MessageReceivedPayload {
  id: string;
  inquiry_id: string;
  sender_id: string;
  sender_role: 'buyer' | 'seller' | 'admin';
  message: string | null;
  created_at: string;
}

/**
 * Event payload for attachment upload broadcast
 */
export interface AttachmentUploadedPayload {
  id: string;
  inquiry_id: string;
  message_id: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

/**
 * Event payload for user joined/left
 */
export interface UserPresencePayload {
  inquiry_id: string;
  user_id: string;
  user_role: 'buyer' | 'seller' | 'admin' | 'super-admin';
  display_name?: string;
  timestamp: string;
}

/**
 * Event payload for typing indicator
 */
export interface UserTypingPayload {
  inquiry_id: string;
  user_id: string;
  user_role: 'buyer' | 'seller' | 'admin' | 'super-admin';
  display_name?: string;
  is_typing: boolean;
}

/**
 * Event payload for inquiry updates
 */
export interface InquiryUpdatedPayload {
  inquiry_id: string;
  status: string;
  assigned_admin_id?: string;
  updated_at: string;
  update_type: 'status_change' | 'admin_assigned' | 'resolved' | 'closed';
}

/**
 * Error event payload
 */
export interface WebSocketErrorPayload {
  code: string;
  message: string;
  details?: any;
}

