import {
  Controller,
  Post,
  Headers,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProxyService } from '../../proxy';

/**
 * Upload Controller (BFF → Admin Service)
 * 
 * Routes for file uploads (used by blog creation form)
 * All routes are protected (admin only)
 */
@ApiTags('admin/upload')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'admin/upload', version: '1' })
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Replace image at existing S3 key (for updating images while keeping same URL)
   * NOTE: This route must come BEFORE 'image' route to ensure proper matching
   */
  @Post('image/replace')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Replace an existing image in S3 (keeps same URL)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'New image file (JPEG, PNG, WebP, max 5MB)',
        },
        existingUrl: {
          type: 'string',
          description: 'Existing S3 image URL to replace',
          example: 'https://bucket.s3.region.amazonaws.com/blogs/123456/image.jpg',
        },
      },
      required: ['file', 'existingUrl'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Image replaced successfully (same URL returned)',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'https://bucket.s3.region.amazonaws.com/blogs/123456/image.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or URL',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async replaceImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Headers('authorization') authHeader: string,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Extract existingUrl from form data
    const existingUrl = req.body?.existingUrl;
    if (!existingUrl) {
      throw new BadRequestException('Existing URL is required');
    }

    this.logger.log(`[BFF → Admin] POST /api/v1/admin/upload/image/replace (${file.originalname})`);
    
    return this.proxyService.proxyFileUpload<{ url: string }>(
      '/api/v1/admin/upload/image/replace',
      file,
      { Authorization: authHeader },
      { existingUrl },
    );
  }

  /**
   * Replace multiple images in S3 (batch operation)
   * NOTE: This route must come BEFORE 'image' route to ensure proper matching
   */
  @Post('images/replace')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  @ApiOperation({ summary: 'Replace multiple existing images in S3 (batch operation)' })
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
          description: 'New image files (JPEG, PNG, WebP, max 5MB each)',
        },
        existingUrls: {
          type: 'string',
          description: 'JSON array of existing S3 image URLs to replace (same order as files)',
          example: '["https://bucket.s3.region.amazonaws.com/blogs/123456/image1.jpg","https://bucket.s3.region.amazonaws.com/blogs/123456/image2.jpg"]',
        },
      },
      required: ['files', 'existingUrls'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'All images replaced successfully (same URLs returned)',
    schema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid files or URLs',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async replaceImagesBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
    @Headers('authorization') authHeader: string,
  ): Promise<{ urls: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Extract existingUrls from form data
    const existingUrls = req.body?.existingUrls;
    if (!existingUrls) {
      throw new BadRequestException('Existing URLs are required');
    }

    this.logger.log(
      `[BFF → Admin] POST /api/v1/admin/upload/images/replace (${files.length} files)`,
    );

    return this.proxyService.proxyBatchFileUpload<{ urls: string[] }>(
      '/api/v1/admin/upload/images/replace',
      files,
      { Authorization: authHeader },
      { existingUrls },
    );
  }

  /**
   * Upload single image (for blog cover, content images)
   */
  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single image for blogs' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP, max 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://s3.amazonaws.com/.../image.jpg' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authHeader: string,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.logger.log(`[BFF → Admin] POST /api/v1/admin/upload/image (${file.originalname})`);
    
    return this.proxyService.proxyFileUpload<{ url: string }>(
      '/api/v1/admin/upload/image',
      file,
      { Authorization: authHeader },
    );
  }

  /**
   * Upload multiple images
   */
  @Post('images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple images' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image files (max 10 files)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Images uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Headers('authorization') authHeader: string,
  ): Promise<{ urls: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    this.logger.log(`[BFF → Admin] POST /api/v1/admin/upload/images (${files.length} files)`);
    
    // Upload files one by one and collect URLs
    const urls: string[] = [];
    for (const file of files) {
      const result = await this.proxyService.proxyFileUpload<{ url: string }>(
        '/api/v1/admin/upload/image',
        file,
        { Authorization: authHeader },
      );
      urls.push(result.url);
    }

    return { urls };
  }
}

