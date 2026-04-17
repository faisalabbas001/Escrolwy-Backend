import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service Auth Guard
 *
 * Protects internal service-to-service endpoints
 * Validates service authentication token
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceToken = request.headers['x-service-token'];

    // Get expected service token from environment
    const expectedToken = this.configService.get<string>(
      'SERVICE_TO_SERVICE_TOKEN',
    );

    if (!serviceToken || !expectedToken) {
      throw new UnauthorizedException('Service authentication required');
    }

    if (serviceToken !== expectedToken) {
      throw new UnauthorizedException('Invalid service token');
    }

    return true;
  }
}
