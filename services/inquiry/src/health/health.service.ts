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
      service: "inquiry-service",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check
   * Verifies database connectivity
   */
  async ready() {
    try {
      // Try a simple database query to verify connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: "ready",
        service: "inquiry-service",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Readiness check failed", error);
      return {
        status: "not-ready",
        service: "inquiry-service",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
