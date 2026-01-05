import { Module } from '@nestjs/common';
import { BlogsModule } from './blogs';
import { HelpDeskModule } from './help-desk';
import { UploadModule } from './upload';

/**
 * Admin Module (BFF)
 * 
 * Groups all routes that proxy to Admin service:
 * - /api/v1/admin/blogs/*
 * - /api/v1/admin/help-desk/*
 * - /api/v1/admin/upload/*
 * 
 * When Admin service adds new features, add them here.
 */
@Module({
  imports: [
    BlogsModule,
    HelpDeskModule,
    UploadModule,
  ],
})
export class AdminModule {}

