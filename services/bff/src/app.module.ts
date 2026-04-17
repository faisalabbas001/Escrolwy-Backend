import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";

import { ProxyModule } from "./proxy";
import { JwtAuthGuard } from "./common";
import { AuthModule } from "./auth";
import { AdminModule } from "./admin";
import { InquiryModule } from "./inquiry";
import { EscrowModule } from "./escrow";
import { LedgerModule } from "./ledger";
import { NotificationModule } from "./notification";
import { HealthModule } from "./health";

/**
 * BFF Application Module
 *
 * Backend for Frontend service that:
 * - Validates JWT tokens (issued by Auth service)
 * - Routes requests to appropriate backend services
 * - Aggregates responses when needed
 *
 * Module structure mirrors backend services:
 * - AuthModule  → Auth Service (port 3000)
 * - AdminModule → Admin Service (port 3002)
 *   - BlogsModule
 *   - HelpDeskModule
 *   - UploadModule
 * - InquiryModule → Inquiry Service (port 3003)
 *   Note: WebSocket connections connect directly from frontend to Inquiry Service
 * - EscrowModule → Escrow Service (port 3004)
 * - LedgerModule → Ledger Service (port 3005)
 * - NotificationModule → Notification Service (port 3005)
 *   Note: Notification Service consumes Kafka events from other services
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      cache: true,
    }),

    // HTTP client for backend services
    ProxyModule,

    // Auth routes → Auth Service
    AuthModule,

    // Admin routes → Admin Service (blogs, help-desk, upload)
    AdminModule,

    // Inquiry routes → Inquiry Service (inquiries, messages, attachments)
    InquiryModule,

    // Escrow routes → Escrow Service (escrows, payments, disputes)
    EscrowModule,

    // Ledger routes → Ledger Service (accounts, transfers, balances)
    LedgerModule,

    // Notification routes → Notification Service (settings, templates, logs)
    NotificationModule,

    // Health check
    HealthModule,
  ],
  providers: [
    // Global JWT auth guard (validates tokens from Auth service)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
