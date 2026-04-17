import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

/**
 * Bootstrap the Compliance Service application
 *
 * Features:
 * - Swagger/OpenAPI documentation
 * - Global validation pipe
 * - CORS configuration
 * - API versioning
 * - Graceful shutdown
 */
async function bootstrap() {
    const logger = new Logger('Bootstrap');

    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
        bodyParser: false,
    });

    app.use(
        bodyParser.json({
            verify: (req: any, res, buf) => {
                req.rawBody = buf; // Buffer
            },
        }),
    );


    // Get configuration service
    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3003);
    const serviceName = configService.get<string>('SERVICE_NAME', 'compliance-service');
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');

    // Enable CORS
    app.enableCors({
        origin: '*',
        credentials: false,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Accept',
            'X-Requested-With',
        ],
    });

    // Global API prefix
    app.setGlobalPrefix('api');

    // Enable API versioning
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Swagger/OpenAPI Documentation
    if (nodeEnv !== 'production') {
        const config = new DocumentBuilder()
            .setTitle('Escrowly Compliance Service')
            .setDescription(
                'Compliance and KYC service for the Escrowly platform. ' +
                'Handles KYC lifecycle, risk evaluation, and limits management.',
            )
            .setVersion('1.0')
            .addTag('health', 'Health check endpoints')
            .addTag('kyc', 'KYC management endpoints')
            .addTag('limits', 'User limits endpoints')
            .addBearerAuth(
                {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter JWT access token',
                },
                'JWT-auth',
            )
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document, {
            swaggerOptions: {
                persistAuthorization: true,
            },
        });

        logger.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
    }

    // Graceful shutdown handlers
    app.enableShutdownHooks();

    // Start the application
    await app.listen(port);

    logger.log(`🚀 ${serviceName} is running on: http://localhost:${port}/api`);
    logger.log(`🌍 Environment: ${nodeEnv}`);
}

bootstrap().catch((error) => {
    console.error('❌ Application failed to start:', error);
    process.exit(1);
});
