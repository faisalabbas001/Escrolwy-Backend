import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { S3Service } from './s3.service';

/**
 * Upload Controller
 * Handles image uploads to AWS S3
 */
@ApiTags('upload')
@ApiBearerAuth('JWT-auth')
@Controller({
  path: 'admin/upload',
  version: '1',
})
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * Replace an existing image in S3 (keeps same URL)
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
  async replaceImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Extract existingUrl from form data
    const existingUrl = req.body?.existingUrl;
    if (!existingUrl) {
      throw new BadRequestException('Existing URL is required');
    }

    const url = await this.s3Service.replaceImage(file, existingUrl);

    return { url };
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
          example: [
            'https://bucket.s3.region.amazonaws.com/blogs/123456/image1.jpg',
            'https://bucket.s3.region.amazonaws.com/blogs/123456/image2.jpg',
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid files or URLs',
  })
  async replaceImagesBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ): Promise<{ urls: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Extract existingUrls from form data (JSON array string)
    const existingUrlsStr = req.body?.existingUrls;
    if (!existingUrlsStr) {
      throw new BadRequestException('Existing URLs are required');
    }

    let existingUrls: string[];
    try {
      existingUrls = JSON.parse(existingUrlsStr);
    } catch (error) {
      throw new BadRequestException(
        'Invalid existingUrls format. Expected JSON array string.',
      );
    }

    if (!Array.isArray(existingUrls)) {
      throw new BadRequestException('existingUrls must be an array');
    }

    if (files.length !== existingUrls.length) {
      throw new BadRequestException(
        `Number of files (${files.length}) must match number of existing URLs (${existingUrls.length})`,
      );
    }

    // Create replacements array
    const replacements = files.map((file, index) => ({
      file,
      existingUrl: existingUrls[index],
    }));

    const urls = await this.s3Service.replaceImagesBatch(replacements);

    return { urls };
  }

  /**
   * Upload single image
   */
  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single image to AWS S3' })
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
        folder: {
          type: 'string',
          description: 'Optional folder path in S3 (default: escrowly-blogs)',
          example: 'escrowly-blogs',
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
        url: {
          type: 'string',
          example: 'https://dev-escrowly-stack-devescrowlyfilesd7d0fc74-e0doc9ny2wst.s3.us-east-1.amazonaws.com/escrowly-blogs/image.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or file too large',
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    folder?: string,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const url = await this.s3Service.uploadImage(
      file,
      folder || 'escrowly-blogs',
    );

    return { url };
  }

  /**
   * Upload multiple images
   */
  @Post('images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
  @ApiOperation({ summary: 'Upload multiple images to AWS S3' })
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
          description: 'Image files (JPEG, PNG, WebP, max 5MB each)',
        },
        folder: {
          type: 'string',
          description: 'Optional folder path in S3 (default: escrowly-blogs)',
          example: 'escrowly-blogs',
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
        urls: {
          type: 'array',
          items: {
            type: 'string',
          },
          example: [
            'https://dev-escrowly-stack-devescrowlyfilesd7d0fc74-e0doc9ny2wst.s3.us-east-1.amazonaws.com/escrowly-blogs/image1.jpg',
            'https://dev-escrowly-stack-devescrowlyfilesd7d0fc74-e0doc9ny2wst.s3.us-east-1.amazonaws.com/escrowly-blogs/image2.jpg',
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid files or files too large',
  })
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    folder?: string,
  ): Promise<{ urls: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const urls = await this.s3Service.uploadMultipleImages(
      files,
      folder || 'escrowly-blogs',
    );

    return { urls };
  }
}

