import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Body,
  Param,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { S3Service } from './s3.service';

/**
 * Upload Controller
 * Handles file uploads to AWS S3 for Inquiry attachments
 */
@ApiTags('inquiries-upload')
@ApiBearerAuth('JWT-auth')
@Controller({
  path: 'inquiries/upload',
  version: '1',
})
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * Upload single file
   * POST /api/v1/inquiries/upload/file
   */
  @Post('file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file to AWS S3 for inquiry attachments' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (images: JPEG, PNG, WebP, GIF; documents: PDF, DOC, DOCX, XLS, XLSX, TXT; max 10MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        file_url: {
          type: 'string',
          example: 'https://bucket.s3.us-east-1.amazonaws.com/escrowly-inquiries/uuid.pdf',
        },
        file_type: {
          type: 'string',
          enum: ['image', 'pdf', 'document', 'spreadsheet', 'other'],
          example: 'pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file type or file too large',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ file_url: string; file_type: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.s3Service.uploadFile(file, 'escrowly-inquiries');

    return {
      file_url: result.url,
      file_type: result.fileType,
    };
  }

  /**
   * Upload multiple files
   * POST /api/v1/inquiries/upload/files
   */
  @Post('files')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  @ApiOperation({ summary: 'Upload multiple files to AWS S3 for inquiry attachments' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Files to upload (max 10 files, each max 10MB)',
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Files uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_url: {
                type: 'string',
                example: 'https://bucket.s3.us-east-1.amazonaws.com/escrowly-inquiries/uuid.pdf',
              },
              file_type: {
                type: 'string',
                enum: ['image', 'pdf', 'document', 'spreadsheet', 'other'],
                example: 'pdf',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid files or files too large',
  })
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ files: Array<{ file_url: string; file_type: string }> }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results = await this.s3Service.uploadMultipleFiles(files, 'escrowly-inquiries');

    return {
      files: results.map((result) => ({
        file_url: result.url,
        file_type: result.fileType,
      })),
    };
  }

  /**
   * Upload file for specific inquiry
   * POST /api/v1/inquiries/upload/:inquiryId/file
   * 
   * This endpoint organizes files by inquiry ID in S3
   */
  @Post(':inquiryId/file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file for a specific inquiry (organized by inquiry ID in S3)' })
  @ApiParam({
    name: 'inquiryId',
    description: 'Inquiry UUID',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (images: JPEG, PNG, WebP, GIF; documents: PDF, DOC, DOCX, XLS, XLSX, TXT; max 10MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        file_url: {
          type: 'string',
          example: 'https://bucket.s3.us-east-1.amazonaws.com/escrowly-inquiries/inquiry-id/uuid.pdf',
        },
        file_type: {
          type: 'string',
          enum: ['image', 'pdf', 'document', 'spreadsheet', 'other'],
          example: 'pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file type or file too large',
  })
  async uploadFileForInquiry(
    @Param('inquiryId') inquiryId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ file_url: string; file_type: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Organize files by inquiry ID in S3
    const folder = `escrowly-inquiries/${inquiryId}`;
    const result = await this.s3Service.uploadFile(file, folder);

    return {
      file_url: result.url,
      file_type: result.fileType,
    };
  }
}

