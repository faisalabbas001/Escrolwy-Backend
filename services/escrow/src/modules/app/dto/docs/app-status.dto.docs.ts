import { ApiProperty } from '@nestjs/swagger';

export class AppStatusDtoDocs {
  @ApiProperty({
    description: 'Status message of the service',
    example: 'Escrow service is running',
    type: String,
  })
  message: string;

  @ApiProperty({
    description: 'Name of the service',
    example: 'escrow',
    type: String,
  })
  service: string;

  @ApiProperty({
    description: 'Version of the service',
    example: '1.0.0',
    type: String,
  })
  version: string;

  @ApiProperty({
    description: 'Timestamp when status was retrieved',
    example: '2025-12-11T10:30:00.000Z',
    type: String,
  })
  timestamp: string;
}
