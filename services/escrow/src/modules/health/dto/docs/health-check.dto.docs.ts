import { ApiProperty } from '@nestjs/swagger';

class MemoryCheckDtoDocs {
  @ApiProperty({
    description: 'Memory check status',
    example: 'ok',
    type: String,
  })
  status: string;

  @ApiProperty({
    description: 'Heap memory used',
    example: '45 MB',
    type: String,
  })
  heapUsed: string;

  @ApiProperty({
    description: 'Total heap memory allocated',
    example: '100 MB',
    type: String,
  })
  heapTotal: string;
}

class ProcessCheckDtoDocs {
  @ApiProperty({
    description: 'Process check status',
    example: 'ok',
    type: String,
  })
  status: string;

  @ApiProperty({
    description: 'Process ID',
    example: 1234,
    type: Number,
  })
  pid: number;

  @ApiProperty({
    description: 'Process uptime',
    example: '3600 seconds',
    type: String,
  })
  uptime: string;
}

class ChecksDtoDocs {
  @ApiProperty({
    type: MemoryCheckDtoDocs,
  })
  memory: MemoryCheckDtoDocs;

  @ApiProperty({
    type: ProcessCheckDtoDocs,
  })
  process: ProcessCheckDtoDocs;
}

export class HealthCheckDtoDocs {
  @ApiProperty({
    description: 'Service readiness status',
    example: true,
    type: Boolean,
  })
  ready: boolean;

  @ApiProperty({
    description: 'Timestamp when readiness check was performed',
    example: '2025-12-11T10:30:00.000Z',
    type: String,
  })
  timestamp: string;

  @ApiProperty({
    type: ChecksDtoDocs,
    description: 'Detailed health checks',
  })
  checks: ChecksDtoDocs;
}
