import { Injectable } from '@nestjs/common';

/**
 * Health Service
 *
 * Provides health check information for monitoring and load balancing
 */
@Injectable()
export class HealthService {
  /**
   * Get basic health status
   */
  getHealthStatus(): Record<string, any> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'escrow',
    };
  }

  /**
   * Get detailed readiness status
   */
  getReadiness(): Record<string, any> {
    return {
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {
        memory: this.checkMemory(),
        process: this.checkProcess(),
      },
    };
  }

  /**
   * Check memory usage
   */
  private checkMemory(): Record<string, any> {
    const memUsage = process.memoryUsage();
    return {
      status: 'ok',
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    };
  }

  /**
   * Check process status
   */
  private checkProcess(): Record<string, any> {
    return {
      status: 'ok',
      pid: process.pid,
      uptime: `${Math.round(process.uptime())} seconds`,
    };
  }
}
