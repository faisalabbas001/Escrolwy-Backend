import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDtoDocs {
  @ApiProperty({
    description: 'Health status of the service',
    example: 'healthy',
    enum: ['healthy', 'unhealthy'],
  })
  status: string;

  @ApiProperty({
    description: 'Timestamp when health check was performed',
    example: '2025-12-11T10:30:00.000Z',
    type: String,
  })
  timestamp: string;

  @ApiProperty({
    description: 'Service uptime in seconds',
    example: 3600,
    type: Number,
  })
  uptime: number;

  @ApiProperty({
    description: 'Name of the service',
    example: 'escrow',
    type: String,
  })
  service: string;
}
