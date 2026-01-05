import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

/**
 * S3 Service
 * Handles file uploads to AWS S3 for Inquiry attachments
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    // Configure S3 Client
    // Use AWS_S3_REGION if available, fallback to AWS_REGION
    this.region = this.configService.get<string>('AWS_S3_REGION') || 
                  this.configService.get<string>('AWS_REGION', 'us-east-1');
    
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');

    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET environment variable is required');
    }

    this.bucketName = bucketName;

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
   * Upload file to S3
   * @param file - Express Multer file object
   * @param folder - Optional folder path in S3
   * @returns Promise with uploaded file URL and file type
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'escrowly-inquiries',
  ): Promise<{ url: string; fileType: string }> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Validate file type - support images and documents for inquiries
      const allowedMimeTypes = [
        // Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // Spreadsheets
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // Text
        'text/plain',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type. Allowed types: images (jpeg, png, webp, gif), documents (pdf, doc, docx), spreadsheets (xls, xlsx), text files`,
        );
      }

      // Validate file size (max 10MB for inquiry attachments)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new BadRequestException('File size exceeds 10MB limit');
      }

      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop() || 'file';
      const fileName = `${randomUUID()}.${fileExtension}`;
      const key = `${folder}/${fileName}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Tagging: 'public=true',
      });

      await this.s3Client.send(command);

      // Construct the public URL
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      // Determine file type category
      const fileType = this.getFileTypeCategory(file.mimetype);

      this.logger.log(`File uploaded successfully: ${url}`);

      return { url, fileType };
    } catch (error) {
      this.logger.error('Error uploading file to S3', error);
      throw error;
    }
  }

  /**
   * Upload multiple files to S3
   * @param files - Array of Express Multer file objects
   * @param folder - Optional folder path in S3
   * @returns Promise with array of uploaded file URLs and types
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'escrowly-inquiries',
  ): Promise<Array<{ url: string; fileType: string }>> {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files provided');
      }

      const uploadPromises = files.map((file) => this.uploadFile(file, folder));
      const results = await Promise.all(uploadPromises);

      return results;
    } catch (error) {
      this.logger.error('Error uploading multiple files', error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   * @param fileUrl - Full S3 file URL
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract key from URL
      // URL format: https://bucket-name.s3.region.amazonaws.com/folder/filename.ext
      const urlPattern = new RegExp(
        `https://${this.bucketName}\\.s3\\.${this.region}\\.amazonaws\\.com/(.+)`,
      );
      const match = fileUrl.match(urlPattern);

      if (!match || !match[1]) {
        this.logger.warn(`Could not extract key from URL: ${fileUrl}`);
        return;
      }

      const key = match[1];

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting file from S3', error);
      // Don't throw error - file might not exist or already deleted
    }
  }

  /**
   * Get file type category from MIME type
   */
  private getFileTypeCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType === 'application/pdf') {
      return 'pdf';
    }
    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return 'document';
    }
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return 'spreadsheet';
    }
    return 'other';
  }
}

