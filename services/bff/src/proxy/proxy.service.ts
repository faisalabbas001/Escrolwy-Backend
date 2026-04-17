import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosRequestConfig, AxiosError } from "axios";
import * as FormData from "form-data";

/**
 * Proxy Service
 *
 * Handles HTTP requests to backend services (Auth, Admin, Inquiry, Escrow, Ledger)
 * 
 * DRY Principle: All proxy methods use the same underlying proxyRequest method
 * to avoid code duplication and ensure consistent error handling.
 */
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly authServiceUrl: string;
  private readonly adminServiceUrl: string;
  private readonly inquiryServiceUrl: string;
  private readonly escrowServiceUrl: string;
  private readonly ledgerServiceUrl: string;
  private readonly notificationServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.authServiceUrl = this.configService.get<string>(
      "AUTH_SERVICE_URL",
      "http://localhost:3000"
    );
    this.adminServiceUrl = this.configService.get<string>(
      "ADMIN_SERVICE_URL",
      "http://localhost:3002"
    );
    this.inquiryServiceUrl = this.configService.get<string>(
      "INQUIRY_SERVICE_URL",
      "http://localhost:3003"
    );
    this.escrowServiceUrl = this.configService.get<string>(
      "ESCROW_SERVICE_URL",
      "http://localhost:3004"
    );
    this.ledgerServiceUrl = this.configService.get<string>(
      "LEDGER_SERVICE_URL",
      "http://localhost:3005"
    );
    this.notificationServiceUrl = this.configService.get<string>(
      "NOTIFICATION_SERVICE_URL",
      "http://localhost:3009"
    );

    // Add request interceptor to log and ensure headers are sent
    this.httpService.axiosRef.interceptors.request.use(
      (config) => {
        if (config.headers) {
          this.logger.debug(`[Axios Interceptor] Request to ${config.url}`);
          this.logger.debug(`[Axios Interceptor] Headers keys: ${Object.keys(config.headers).join(', ')}`);
          const authHeader = config.headers['Authorization'] || config.headers['authorization'];
          if (authHeader) {
            this.logger.debug(`[Axios Interceptor] Authorization header: ${typeof authHeader === 'string' ? authHeader.substring(0, 20) + '...' : 'present (not string)'}`);
          } else {
            this.logger.warn(`[Axios Interceptor] No Authorization header in request to ${config.url}`);
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Proxy request to Auth service
   */
  async proxyToAuth<T>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.proxyRequest<T>(
      this.authServiceUrl,
      method,
      path,
      data,
      headers
    );
  }

  /**
   * Proxy request to Admin service
   */
  async proxyToAdmin<T>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.proxyRequest<T>(
      this.adminServiceUrl,
      method,
      path,
      data,
      headers
    );
  }

  /**
   * Proxy request to Inquiry service
   */
  async proxyToInquiry<T>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.proxyRequest<T>(
      this.inquiryServiceUrl,
      method,
      path,
      data,
      headers
    );
  }

  /**
   * Proxy request to Escrow service
   */
  async proxyToEscrow<T>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.proxyRequest<T>(
      this.escrowServiceUrl,
      method,
      path,
      data,
      headers
    );
  }

  /**
   * Proxy request to Ledger service
   */
  async proxyToLedger<T>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.proxyRequest<T>(
      this.ledgerServiceUrl,
      method,
      path,
      data,
      headers
    );
  }

  /**
   * Proxy request to Notification service
   */
  async proxyToNotification<T>(
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.proxyRequest<T>(
      this.notificationServiceUrl,
      method,
      path,
      data,
      headers
    );
  }

  /**
   * Proxy file upload to Admin service
   */
  async proxyFileUpload<T>(
    path: string,
    file: Express.Multer.File,
    headers?: Record<string, string>,
    additionalFields?: Record<string, string>
  ): Promise<T> {
    return this.proxyFileUploadToService<T>(
      this.adminServiceUrl,
      path,
      file,
      headers,
      additionalFields
    );
  }

  /**
   * Proxy file upload to Inquiry service
   */
  async proxyFileUploadToInquiry<T>(
    path: string,
    file: Express.Multer.File,
    headers?: Record<string, string>,
    additionalFields?: Record<string, string>
  ): Promise<T> {
    return this.proxyFileUploadToService<T>(
      this.inquiryServiceUrl,
      path,
      file,
      headers,
      additionalFields
    );
  }

  /**
   * Generic file upload proxy (DRY - used by both Admin and Inquiry)
   */
  private async proxyFileUploadToService<T>(
    baseUrl: string,
    path: string,
    file: Express.Multer.File,
    headers?: Record<string, string>,
    additionalFields?: Record<string, string>
  ): Promise<T> {
    const url = `${baseUrl}${path}`;

    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    // Append additional form fields if provided
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const config: AxiosRequestConfig = {
      headers: {
        ...formData.getHeaders(),
        ...headers,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000, // Set timeout to 60 seconds for file uploads
    };

    try {
      this.logger.debug(`Proxying file upload to: ${url}`);
      const response = await firstValueFrom(
        this.httpService.post(url, formData, config)
      );
      return response.data;
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Proxy batch file upload to Admin service
   */
  async proxyBatchFileUpload<T>(
    path: string,
    files: Express.Multer.File[],
    headers?: Record<string, string>,
    additionalFields?: Record<string, string>
  ): Promise<T> {
    const url = `${this.adminServiceUrl}${path}`;

    const formData = new FormData();
    
    // Append all files
    files.forEach((file) => {
      formData.append("files", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    });

    // Append additional fields
    if (additionalFields) {
      for (const key in additionalFields) {
        formData.append(key, additionalFields[key]);
      }
    }

    const config: AxiosRequestConfig = {
      headers: {
        ...formData.getHeaders(),
        ...headers,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000, // Set timeout to 60 seconds for file uploads
    };

    try {
      this.logger.debug(`Proxying batch file upload to: ${url} (${files.length} files)`);
      const response = await firstValueFrom(
        this.httpService.post(url, formData, config)
      );
      return response.data;
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Generic proxy request
   */
  private async proxyRequest<T>(
    baseUrl: string,
    method: string,
    path: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = `${baseUrl}${path}`;

    // Filter out undefined/null headers to ensure they're properly sent
    const cleanHeaders: Record<string, string> = {};
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          cleanHeaders[key] = value;
        }
      });
    }

    // Build headers object
    // Note: Axios normalizes headers to standard HTTP case (e.g., "Authorization")
    // Express/NestJS then normalizes them to lowercase (e.g., "authorization")
    // So we set it with standard HTTP case and let the frameworks handle normalization
    const requestHeaders: Record<string, string> = {};
    
    // Copy all clean headers, ensuring authorization uses standard HTTP case
    Object.entries(cleanHeaders).forEach(([key, value]) => {
      // Use standard HTTP header case for authorization
      if (key.toLowerCase() === 'authorization') {
        requestHeaders['Authorization'] = value;
      } else {
        requestHeaders[key] = value;
      }
    });
    
    // Only set Content-Type if not FormData (FormData sets its own Content-Type with boundary)
    if (!(data instanceof FormData)) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const config: AxiosRequestConfig = {
      method: method.toLowerCase() as any,
      url,
      headers: requestHeaders,
    };

    // Only include data if it's not null/undefined
    if (data !== null && data !== undefined) {
      config.data = data;
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.log(`[PROXY] [${requestId}] ────────────────────────────────────────────────────────────────`);
      this.logger.log(`[PROXY] [${requestId}] → Proxying ${method} request to: ${url}`);
      this.logger.log(`[PROXY] [${requestId}] Request Headers Keys: ${Object.keys(requestHeaders).join(', ')}`);
      
      const authHeader = requestHeaders.Authorization || requestHeaders.authorization;
      if (authHeader) {
        this.logger.log(`[PROXY] [${requestId}] ✅ Authorization header PRESENT`);
        this.logger.log(`[PROXY] [${requestId}] Authorization Header Prefix: ${authHeader.substring(0, 30)}...`);
        this.logger.log(`[PROXY] [${requestId}] Authorization Header Full Length: ${authHeader.length}`);
        this.logger.log(`[PROXY] [${requestId}] Authorization Header Value: ${authHeader}`);
      } else {
        this.logger.error(`[PROXY] [${requestId}] ❌ ERROR: No Authorization header in proxy request`);
        this.logger.error(`[PROXY] [${requestId}] Available headers: ${Object.keys(requestHeaders).join(', ')}`);
        this.logger.error(`[PROXY] [${requestId}] All headers: ${JSON.stringify(requestHeaders)}`);
      }
      
      // Log the actual config being sent to Axios
      this.logger.log(`[PROXY] [${requestId}] Axios Config Headers: ${JSON.stringify(Object.keys(config.headers || {}))}`);
      this.logger.log(`[PROXY] [${requestId}] Axios Config Authorization: ${config.headers?.['Authorization'] || config.headers?.['authorization'] || 'MISSING'}`);
      this.logger.log(`[PROXY] [${requestId}] ────────────────────────────────────────────────────────────────`);
      this.logger.log(`[PROXY] [${requestId}] → Sending HTTP request via Axios...`);
      
      const response = await firstValueFrom(this.httpService.request(config));
      
      this.logger.log(`[PROXY] [${requestId}] ✅ SUCCESS: Received response from ${url}`);
      this.logger.log(`[PROXY] [${requestId}] Response Status: ${response.status}`);
      this.logger.log(`[PROXY] [${requestId}] Response Headers: ${JSON.stringify(Object.keys(response.headers))}`);
      this.logger.log(`[PROXY] [${requestId}] Response Data: ${JSON.stringify(response.data)}`);
      this.logger.log(`[PROXY] [${requestId}] ────────────────────────────────────────────────────────────────`);
      
      return response.data;
    } catch (error) {
      this.logger.error(`[PROXY] [${requestId}] ❌ ERROR: Failed to proxy request to ${url}`);
      
      if (error instanceof AxiosError) {
        this.logger.error(`[PROXY] [${requestId}] Error Type: AxiosError`);
        this.logger.error(`[PROXY] [${requestId}] Error Status: ${error.response?.status || 'NO_RESPONSE'}`);
        this.logger.error(`[PROXY] [${requestId}] Error Message: ${error.response?.data?.message || error.message}`);
        this.logger.error(`[PROXY] [${requestId}] Error Response Data: ${JSON.stringify(error.response?.data || {})}`);
        this.logger.error(`[PROXY] [${requestId}] Error Response Headers: ${JSON.stringify(error.response?.headers || {})}`);
        
        // Check if it's an auth error
        if (error.response?.status === 401 || error.response?.status === 403) {
          this.logger.error(`[PROXY] [${requestId}] ⚠️  AUTHENTICATION/AUTHORIZATION ERROR DETECTED`);
          this.logger.error(`[PROXY] [${requestId}] This suggests the JWT token was not accepted by the escrow service`);
          this.logger.error(`[PROXY] [${requestId}] Check if the Authorization header was properly forwarded`);
        }
      } else {
        this.logger.error(`[PROXY] [${requestId}] Error Type: ${error?.constructor?.name || 'UNKNOWN'}`);
        this.logger.error(`[PROXY] [${requestId}] Error Message: ${error?.message || 'UNKNOWN'}`);
      }
      
      this.logger.error(`[PROXY] [${requestId}] ────────────────────────────────────────────────────────────────`);
      
      this.handleError(error, url);
    }
  }

  /**
   * Handle proxy errors
   */
  private handleError(error: any, url: string): never {
    if (error instanceof AxiosError) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.message || error.message;
      const errorData = error.response?.data || { message };

      this.logger.error(`Proxy error for ${url}: ${status} - ${message}`);

      throw new HttpException(errorData, status);
    }

    this.logger.error(`Unexpected proxy error for ${url}:`, error);
    throw new HttpException(
      { message: "Internal server error" },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
