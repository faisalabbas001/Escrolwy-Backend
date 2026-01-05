import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

/**
 * S3 Service
 * Handles image uploads to AWS S3
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    // Configure S3 Client
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName = this.configService.get<string>('S3_BUCKET');

    if (!this.bucketName) {
      throw new Error('S3_BUCKET environment variable is required');
    }

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log('S3 service initialized');
  }

  /**
   * Upload image to S3
   * @param file - Express Multer file object
   * @param folder - Optional folder path in S3
   * @returns Promise with uploaded image URL
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'escrowly-blogs',
  ): Promise<string> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
        );
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds 5MB limit');
      }

      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${randomUUID()}.${fileExtension}`;
      const adminId = "123456"
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `blogs/${adminId}/${fileName}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        Tagging: "public=true"
        // ACL: 'public-read', // Make the file publicly accessible
      });

      await this.s3Client.send(command);

        // Construct the public URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/blogs/${adminId}/${fileName}`;

      this.logger.log(`Image uploaded successfully: ${url}`);

      return url;
    } catch (error) {
      this.logger.error('Error uploading image to S3', error);
      throw error;
    }
  }

  /**
   * Upload multiple images to S3
   * @param files - Array of Express Multer file objects
   * @param folder - Optional folder path in S3
   * @returns Promise with array of uploaded image URLs
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = 'escrowly-blogs',
  ): Promise<string[]> {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files provided');
      }

      const uploadPromises = files.map((file) => this.uploadImage(file, folder));
      const urls = await Promise.all(uploadPromises);

      return urls;
    } catch (error) {
      this.logger.error('Error uploading multiple images', error);
      throw error;
    }
  }

  /**
   * Replace image at existing S3 key (keeps same URL)
   * @param file - Express Multer file object
   * @param existingUrl - Existing S3 image URL to replace
   * @returns Promise with the same URL (unchanged)
   */
  async replaceImage(file: Express.Multer.File, existingUrl: string): Promise<string> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }
      if (!existingUrl) {
        throw new BadRequestException('Existing URL is required');
      }

      // Validate file type and size
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
        );
      }
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds 5MB limit');
      }

      // Extract key from existing URL - try multiple URL formats
      let key: string | null = null;

      // Method 1: Try standard S3 URL format: https://bucket-name.s3.region.amazonaws.com/path/to/file
      const urlPattern1 = new RegExp(
        `https://${this.bucketName}\\.s3\\.${this.region}\\.amazonaws\\.com/(.+)`,
      );
      const match1 = existingUrl.match(urlPattern1);
      if (match1 && match1[1]) {
        key = match1[1];
        this.logger.log(`Extracted key using pattern 1: ${key}`);
      }

      // Method 2: Try alternative S3 URL format: https://bucket-name.s3.amazonaws.com/path/to/file
      if (!key) {
        const urlPattern2 = new RegExp(
          `https://${this.bucketName}\\.s3\\.amazonaws\\.com/(.+)`,
        );
        const match2 = existingUrl.match(urlPattern2);
        if (match2 && match2[1]) {
          key = match2[1];
          this.logger.log(`Extracted key using pattern 2: ${key}`);
        }
      }

      // Method 3: Try generic S3 URL format: https://s3.region.amazonaws.com/bucket-name/path/to/file
      if (!key) {
        const urlPattern3 = new RegExp(
          `https://s3\\.${this.region}\\.amazonaws\\.com/${this.bucketName}/(.+)`,
        );
        const match3 = existingUrl.match(urlPattern3);
        if (match3 && match3[1]) {
          key = match3[1];
          this.logger.log(`Extracted key using pattern 3: ${key}`);
        }
      }

      // Method 4: Try parsing as generic URL and extract pathname
      if (!key) {
        try {
          const url = new URL(existingUrl);
          const pathname = url.pathname;
          
          // Remove leading slash and bucket name if present
          let path = pathname.substring(1); // Remove leading slash
          
          // If path starts with bucket name, remove it
          if (path.startsWith(`${this.bucketName}/`)) {
            path = path.substring(this.bucketName.length + 1);
          }
          
          if (path && path.trim() !== '') {
            key = path;
            this.logger.log(`Extracted key using URL parsing: ${key}`);
          }
        } catch (urlError) {
          this.logger.warn(`Failed to parse URL: ${existingUrl}`, urlError);
        }
      }

      // If still no key found, throw error
      if (!key || key.trim() === '') {
        this.logger.error(`Could not extract S3 key from URL: ${existingUrl}`);
        throw new BadRequestException(
          `Could not extract S3 key from existing URL. URL format not recognized: ${existingUrl}`,
        );
      }

      // Remove any query parameters from key (like ?v=timestamp)
      key = key.split('?')[0];

      this.logger.log(`Replacing image at S3 key: ${key}`);

      // Upload new file to the same key, effectively replacing it
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Tagging: 'public=true',
      });

      await this.s3Client.send(command);
      this.logger.log(`Image replaced successfully at key: ${key}`);

      // Return the original URL as it remains the same
      return existingUrl;
    } catch (error) {
      this.logger.error('Error replacing image in S3', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to replace image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Replace multiple images at existing S3 keys (batch operation)
   * @param replacements - Array of { file: Express.Multer.File, existingUrl: string }
   * @returns Promise with array of URLs (same URLs as input, unchanged)
   */
  async replaceImagesBatch(
    replacements: Array<{ file: Express.Multer.File; existingUrl: string }>,
  ): Promise<string[]> {
    try {
      if (!replacements || replacements.length === 0) {
        throw new BadRequestException('No replacements provided');
      }

      const results: string[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      // Process all replacements in parallel
      const promises = replacements.map(async (replacement, index) => {
        try {
          const url = await this.replaceImage(replacement.file, replacement.existingUrl);
          return { index, url, success: true };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Error replacing image ${index} (${replacement.existingUrl}):`,
            error,
          );
          return { index, error: errorMessage, success: false };
        }
      });

      const results_array = await Promise.all(promises);

      // Sort results by index to maintain order
      results_array.sort((a, b) => a.index - b.index);

      // Collect results and errors
      for (const result of results_array) {
        if (result.success) {
          results.push(result.url);
        } else {
          errors.push({ index: result.index, error: result.error });
        }
      }

      // If any replacements failed, throw error with details
      if (errors.length > 0) {
        const errorDetails = errors
          .map((e) => `Image ${e.index}: ${e.error}`)
          .join('; ');
        throw new BadRequestException(
          `Failed to replace ${errors.length} of ${replacements.length} images: ${errorDetails}`,
        );
      }

      this.logger.log(
        `Successfully replaced ${results.length} images in batch`,
      );
      return results;
    } catch (error) {
      this.logger.error('Error in batch image replacement', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to replace images: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete image from S3
   * @param imageUrl - Full S3 image URL
   */
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract key from URL
      // URL format: https://bucket-name.s3.region.amazonaws.com/folder/filename.ext
      const urlPattern = new RegExp(
        `https://${this.bucketName}\\.s3\\.${this.region}\\.amazonaws\\.com/(.+)`,
      );
      const match = imageUrl.match(urlPattern);

      if (!match || !match[1]) {
        this.logger.warn(`Could not extract key from URL: ${imageUrl}`);
        return;
      }

      const key = match[1];

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Image deleted: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting image from S3', error);
      // Don't throw error - image might not exist or already deleted
    }
  }
}

