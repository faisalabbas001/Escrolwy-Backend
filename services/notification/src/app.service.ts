import { Injectable, Logger } from "@nestjs/common";

/**
 * App Service
 *
 * Root service for the Notification microservice
 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    this.logger.log("App Service - Hello endpoint called");
    return "Notification Service is running!";
  }
}

