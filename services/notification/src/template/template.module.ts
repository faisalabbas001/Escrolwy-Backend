import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TemplateService } from "./template.service";
import { DbTemplateService } from "./db-template.service";
import { ResendTemplateService } from "./resend-template.service";
import { TemplateController } from "./template.controller";
import { PrismaModule } from "../prisma";

/**
 * Template Module
 *
 * Provides:
 * - Email template rendering using Handlebars (TemplateService)
 * - Database-based template metadata management (DbTemplateService)
 * - Admin CRUD operations for templates (TemplateController)
 *
 * Architecture:
 * - Templates are stored in the database (metadata only)
 * - Templates must exist in Resend Dashboard with matching templateId
 * - TemplateService uses database to fetch template metadata for rendering
 *
 * Reference: https://resend.com/docs/dashboard/templates/introduction
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [TemplateService, DbTemplateService, ResendTemplateService],
  controllers: [TemplateController],
  exports: [TemplateService, DbTemplateService],
})
export class TemplateModule {}

