import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

/**
 * Service-to-Service Authentication Guard
 *
 * Validates API key in X-Service-Api-Key header for internal service-to-service communication.
 * Only services with valid API keys can access internal endpoints.
 */
export const IS_SERVICE_ONLY_KEY = 'isServiceOnly';

/**
 * Decorator to mark endpoints as service-only (internal APIs)
 * Only services with valid API keys can access these endpoints
 */
export const ServiceOnly = () => SetMetadata(IS_SERVICE_ONLY_KEY, true);

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(ServiceAuthGuard.name);
  private readonly serviceApiKey: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.serviceApiKey = this.configService.get<string>(
      'SERVICE_API_KEY',
      'default-service-key-change-in-production',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Check if endpoint is marked as service-only
    const isServiceOnly = this.reflector.getAllAndOverride<boolean>(IS_SERVICE_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isServiceOnly) {
      // Not a service-only endpoint, allow (other guards will handle auth)
      return true;
    }

    // Extract service API key from header
    const apiKey = request.headers['x-service-api-key'] || request.headers['x-service-apikey'];

    if (!apiKey) {
      this.logger.warn('Service API key missing for service-only endpoint');
      throw new UnauthorizedException('Service API key required for internal endpoints');
    }

    if (apiKey !== this.serviceApiKey) {
      this.logger.warn('Invalid service API key provided');
      throw new UnauthorizedException('Invalid service API key');
    }

    // Attach service context to request
    request.serviceContext = {
      serviceId: request.headers['x-service-id'] || 'unknown',
      apiKey: apiKey.substring(0, 8) + '...', // Log partial key only
    };

    return true;
  }
}

