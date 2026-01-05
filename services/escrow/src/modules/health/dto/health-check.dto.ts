export class HealthCheckDto {
  ready: boolean;
  timestamp: string;
  checks: {
    memory: {
      status: string;
      heapUsed: string;
      heapTotal: string;
    };
    process: {
      status: string;
      pid: number;
      uptime: string;
    };
  };
}
