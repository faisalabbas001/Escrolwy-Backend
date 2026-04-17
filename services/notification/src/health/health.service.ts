import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma";

/**
 * Health Service
 *
 * Provides health check functionality
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Basic health check
   * Returns service status
   */
  check() {
    return {
      status: "ok",
      service: "notification-service",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check
   * Verifies database connectivity, Kafka, and Resend
   */
  async ready() {
    const checks: Record<string, string> = {};
    let allHealthy = true;

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "connected";
    } catch (error) {
      checks.database = "disconnected";
      allHealthy = false;
    }

    // Kafka check (if enabled)
    // TODO: Add Kafka health check

    // Resend check (if API key configured)
    // TODO: Add Resend health check

    return {
      status: allHealthy ? "ready" : "not-ready",
      service: "notification-service",
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}

