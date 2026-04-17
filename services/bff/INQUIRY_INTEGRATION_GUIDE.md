# Inquiry Service BFF Integration - Implementation Guide

> **Complete implementation guide for the Inquiry Service integration in the BFF, following production-grade NestJS patterns and DRY principles**

---

## Table of Contents

1. [High-Level Explanation](#high-level-explanation)
2. [Architecture Decisions](#architecture-decisions)
3. [Code Implementation](#code-implementation)
4. [Request Flow Diagrams](#request-flow-diagrams)
5. [Anti-Patterns Avoided](#anti-patterns-avoided)
6. [WebSocket Architecture](#websocket-architecture)

---

## High-Level Explanation

### Why This Design is Correct

This implementation follows the **Single Responsibility Principle** and **DRY (Don't Repeat Yourself)** to create a maintainable, scalable BFF layer:

1. **BFF as Pure Proxy**: The BFF acts exclusively as an HTTP proxy layer - it validates JWT tokens globally, forwards requests to backend services, and returns responses unchanged. It contains **zero business logic**.

2. **DRY Enforcement**: All proxy methods (`proxyToAuth`, `proxyToAdmin`, `proxyToInquiry`) use the same underlying `proxyRequest` method. File upload methods use a shared `proxyFileUploadToService` method. This eliminates code duplication and ensures consistent error handling.

3. **Thin Controllers**: Controllers are intentionally thin - they accept requests, extract parameters, build paths/query strings, and forward to `ProxyService`. No try/catch blocks, no business logic, no token decoding.

4. **Consistent Patterns**: The implementation follows the exact same patterns used for Auth and Admin services, making it predictable and maintainable.

### How DRY is Enforced

**1. Generic Proxy Method**:
```typescript
// Single source of truth for HTTP proxying
private async proxyRequest<T>(baseUrl, method, path, data?, headers?): Promise<T>
```

**2. Service-Specific Wrappers**:
```typescript
proxyToAuth()   → calls proxyRequest(authServiceUrl, ...)
proxyToAdmin()  → calls proxyRequest(adminServiceUrl, ...)
proxyToInquiry() → calls proxyRequest(inquiryServiceUrl, ...)
```

**3. Generic File Upload**:
```typescript
// Shared implementation for all services
private async proxyFileUploadToService<T>(baseUrl, path, file, headers?, additionalFields?)

// Service-specific wrappers
proxyFileUpload()           → calls proxyFileUploadToService(adminServiceUrl, ...)
proxyFileUploadToInquiry() → calls proxyFileUploadToService(inquiryServiceUrl, ...)
```

### Why BFF Stays Thin

- **No Business Logic**: Controllers never make decisions - they just route
- **No Data Transformation**: Responses are forwarded unchanged
- **No Authorization**: Role checks happen in Inquiry Service
- **No State**: BFF is stateless (no DB, no Redis, no in-memory state)
- **Single Responsibility**: Each component has one job

---

## Architecture Decisions

### 1. Abstract Proxy Logic (DRY)

**Decision**: Use a single reusable `proxyRequest` method with service-specific wrappers.

**Rationale**: 
- Eliminates code duplication
- Ensures consistent error handling across all services
- Makes it easy to add new services (just add a wrapper method)

**Implementation**:
```typescript
// Generic implementation (private)
private async proxyRequest<T>(baseUrl, method, path, data?, headers?): Promise<T>

// Public service-specific methods
async proxyToAuth<T>(...) → proxyRequest(authServiceUrl, ...)
async proxyToAdmin<T>(...) → proxyRequest(adminServiceUrl, ...)
async proxyToInquiry<T>(...) → proxyRequest(inquiryServiceUrl, ...)
```

### 2. Controller Design (Clean & Thin)

**Decision**: Controllers only handle routing, parameter extraction, and path building.

**Rationale**:
- Easier to test (no complex logic)
- Easier to maintain (clear responsibilities)
- Follows NestJS best practices

**Pattern**:
```typescript
@Get(':id')
async getInquiry(@Param('id') id: string, @Headers('authorization') authHeader: string) {
  // 1. Log
  this.logger.log(`[BFF → Inquiry] GET /api/v1/inquiries/${id}`);
  
  // 2. Forward (no try/catch, no logic, no transformation)
  return this.proxyService.proxyToInquiry('GET', `/api/v1/inquiries/${id}`, null, {
    Authorization: authHeader,
  });
}
```

### 3. Module Organization

**Decision**: Separate controllers for user and admin endpoints.

**Rationale**:
- Clear separation of concerns
- Matches existing Admin module pattern (BlogsModule, HelpDeskModule)
- Makes routes more maintainable

**Structure**:
```
src/inquiry/
├── inquiry.controller.ts       # User endpoints: /api/v1/inquiries/*
├── admin-inquiry.controller.ts # Admin endpoints: /api/v1/admin/inquiries/*
├── inquiry.module.ts
└── index.ts
```

### 4. Route Conventions

**Decision**: Follow kebab-case, API versioning, and clear path structure.

**Routes**:
- User: `/api/v1/inquiries/*`
- Admin: `/api/v1/admin/inquiries/*`
- Query parameters: Built with `URLSearchParams`

### 5. Environment Configuration

**Decision**: Use `INQUIRY_SERVICE_URL` environment variable.

**Configuration**:
```env
# Development
INQUIRY_SERVICE_URL=http://localhost:3003

# Docker (internal network)
INQUIRY_SERVICE_URL=http://inquiry-service:3003
```

---

## Code Implementation

### ProxyService (Refactored, Reusable)

```typescript
@Injectable()
export class ProxyService {
  private readonly inquiryServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.inquiryServiceUrl = this.configService.get<string>(
      "INQUIRY_SERVICE_URL",
      "http://localhost:3003"
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

  // Generic implementations (private) - shared by all services
  private async proxyRequest<T>(baseUrl, method, path, data?, headers?): Promise<T> {
    // Single implementation for all HTTP requests
  }

  private async proxyFileUploadToService<T>(baseUrl, path, file, headers?, additionalFields?): Promise<T> {
    // Single implementation for all file uploads
  }
}
```

### InquiryController (User Endpoints)

```typescript
@ApiTags('inquiries')
@Controller({ path: 'inquiries', version: '1' })
export class InquiryController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  async createInquiry(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('[BFF → Inquiry] POST /api/v1/inquiries');
    return this.proxyService.proxyToInquiry(
      'POST',
      '/api/v1/inquiries',
      body,
      { Authorization: authHeader },
    );
  }

  @Get(':inquiryId')
  @ApiBearerAuth('JWT-auth')
  async getInquiry(
    @Param('inquiryId') inquiryId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log(`[BFF → Inquiry] GET /api/v1/inquiries/${inquiryId}`);
    return this.proxyService.proxyToInquiry(
      'GET',
      `/api/v1/inquiries/${inquiryId}`,
      null,
      { Authorization: authHeader },
    );
  }

  // ... other endpoints follow same pattern
}
```

### AdminInquiryController (Admin Endpoints)

```typescript
@ApiTags('admin/inquiries')
@Controller({ path: 'admin/inquiries', version: '1' })
export class AdminInquiryController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  async listInquiries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('assignedAdminId') assignedAdminId?: string,
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    // Build query string
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (status) queryParams.append('status', status);
    if (assignedAdminId) queryParams.append('assignedAdminId', assignedAdminId);
    
    const queryString = queryParams.toString();
    const path = `/api/v1/admin/inquiries${queryString ? `?${queryString}` : ''}`;
    
    this.logger.log(`[BFF → Inquiry] GET ${path}`);
    return this.proxyService.proxyToInquiry('GET', path, null, {
      Authorization: authHeader,
    });
  }

  // ... other endpoints follow same pattern
}
```

### InquiryModule

```typescript
@Module({
  controllers: [InquiryController, AdminInquiryController],
})
export class InquiryModule {}
```

### AppModule Integration

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env", cache: true }),
    ProxyModule,      // Global - provides ProxyService
    AuthModule,       // Auth routes
    AdminModule,      // Admin routes
    InquiryModule,    // Inquiry routes ← NEW
    HealthModule,     // Health checks
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Global JWT validation
    },
  ],
})
export class AppModule {}
```

---

## Request Flow Diagrams

### HTTP REST Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  POST /api/v1/inquiries                                         │
│  Headers: { Authorization: "Bearer <jwt-token>" }               │
│  Body: { escrow_id: "...", subject: "..." }                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Request
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BFF SERVICE (Port 3001)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. Global Validation Pipe                               │   │
│  │     - Validates request body                             │   │
│  │     - Transforms types                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  2. JwtAuthGuard (Global)                                │   │
│  │     - Extracts token from Authorization header           │   │
│  │     - Validates JWT signature                            │   │
│  │     - Validates issuer: "escrowly-auth"                  │   │
│  │     - Validates audience: "escrowly"                     │   │
│  │     - Attaches user to request.user                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  3. InquiryController.createInquiry()                    │   │
│  │     - Extracts Authorization header                      │   │
│  │     - Logs request                                       │   │
│  │     - Calls proxyService.proxyToInquiry()                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  4. ProxyService.proxyToInquiry()                        │   │
│  │     - Calls proxyRequest(inquiryServiceUrl, ...)         │   │
│  │     - Constructs URL: http://inquiry-service:3003/...   │   │
│  │     - Forwards request with Authorization header         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Request
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INQUIRY SERVICE (Port 3003)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  5. InquiryController.createInquiry()                    │   │
│  │     - Validates JWT token (from Authorization header)    │   │
│  │     - Checks user role (authorization)                   │   │
│  │     - Creates inquiry in database                        │   │
│  │     - Publishes Kafka event (via outbox pattern)         │   │
│  │     - Returns inquiry response                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Response
                         │ { id: "...", escrow_id: "...", ... }
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BFF SERVICE                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  6. ProxyService forwards response unchanged             │   │
│  │     - No transformation                                  │   │
│  │     - No data modification                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Response (unchanged)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  Receives: { id: "...", escrow_id: "...", ... }                 │
└─────────────────────────────────────────────────────────────────┘
```

### WebSocket Connection Flow (NOT Proxied by BFF)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  const socket = io('http://localhost:3003/inquiry', {           │
│    auth: { token: accessToken }                                 │
│  });                                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ WebSocket Connection (ws://)
                         │ (Bypasses BFF entirely)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INQUIRY SERVICE (Port 3003)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  InquiryGateway (Socket.IO)                              │   │
│  │  - Validates JWT token from auth.token                   │   │
│  │  - Establishes WebSocket connection                      │   │
│  │  - Handles real-time events                              │   │
│  │    - JOIN_INQUIRY                                        │   │
│  │    - SEND_MESSAGE                                        │   │
│  │    - MESSAGE_RECEIVED                                    │   │
│  │    - USER_TYPING                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

Note: BFF does NOT handle WebSocket connections.
      Frontend connects directly to Inquiry Service.
```

---

## Anti-Patterns Avoided

### ❌ Fat Controllers

**Anti-Pattern**:
```typescript
// BAD: Business logic in controller
@Post()
async createInquiry(@Body() body: any) {
  // Validate escrow exists
  const escrow = await this.escrowService.getEscrow(body.escrow_id);
  if (!escrow) throw new BadRequestException('Escrow not found');
  
  // Check user permissions
  if (escrow.buyer_id !== user.id && escrow.seller_id !== user.id) {
    throw new ForbiddenException();
  }
  
  // Create inquiry
  return this.inquiryService.create(body);
}
```

**✅ Correct Pattern**:
```typescript
// GOOD: Thin controller, just forwards
@Post()
async createInquiry(
  @Body() body: any,
  @Headers('authorization') authHeader: string,
): Promise<any> {
  this.logger.log('[BFF → Inquiry] POST /api/v1/inquiries');
  return this.proxyService.proxyToInquiry('POST', '/api/v1/inquiries', body, {
    Authorization: authHeader,
  });
}
```

### ❌ Business Logic in BFF

**Anti-Pattern**:
```typescript
// BAD: BFF makes business decisions
async getInquiry(id: string) {
  const inquiry = await this.proxyToInquiry('GET', `/inquiries/${id}`);
  
  // BFF modifying data
  inquiry.messages = inquiry.messages.map(msg => ({
    ...msg,
    isFromMe: msg.sender_id === this.user.id, // Business logic!
  }));
  
  return inquiry;
}
```

**✅ Correct Pattern**:
```typescript
// GOOD: BFF forwards unchanged
async getInquiry(id: string) {
  return this.proxyService.proxyToInquiry('GET', `/api/v1/inquiries/${id}`);
}
```

### ❌ WebSocket Proxying

**Anti-Pattern**:
```typescript
// BAD: Trying to proxy WebSockets through BFF
@WebSocketGateway({ namespace: '/inquiry' })
export class InquiryWebSocketGateway {
  // This would make BFF stateful and add unnecessary complexity
}
```

**✅ Correct Pattern**:
- Frontend connects directly to Inquiry Service
- BFF only handles HTTP REST
- WebSocket authentication happens in Inquiry Service

### ❌ Duplicate Proxy Methods

**Anti-Pattern**:
```typescript
// BAD: Copy-paste code for each service
async proxyToInquiry(method, path, data, headers) {
  const url = `${this.inquiryServiceUrl}${path}`;
  const config = { method, url, headers, data };
  try {
    const response = await firstValueFrom(this.httpService.request(config));
    return response.data;
  } catch (error) {
    // Error handling...
  }
}

async proxyToAdmin(method, path, data, headers) {
  const url = `${this.adminServiceUrl}${path}`;
  const config = { method, url, headers, data };
  try {
    const response = await firstValueFrom(this.httpService.request(config));
    return response.data;
  } catch (error) {
    // Error handling... (duplicated!)
  }
}
```

**✅ Correct Pattern**:
```typescript
// GOOD: Single implementation, service-specific wrappers
private async proxyRequest<T>(baseUrl, method, path, data?, headers?): Promise<T> {
  // Single source of truth
}

async proxyToInquiry(...) {
  return this.proxyRequest(this.inquiryServiceUrl, ...);
}

async proxyToAdmin(...) {
  return this.proxyRequest(this.adminServiceUrl, ...);
}
```

### ❌ Try/Catch in Controllers

**Anti-Pattern**:
```typescript
// BAD: Controllers handling errors
@Get(':id')
async getInquiry(@Param('id') id: string) {
  try {
    return await this.proxyService.proxyToInquiry('GET', `/inquiries/${id}`);
  } catch (error) {
    // Error handling in controller (wrong place!)
    if (error.status === 404) {
      throw new NotFoundException('Inquiry not found');
    }
    throw error;
  }
}
```

**✅ Correct Pattern**:
```typescript
// GOOD: Let ProxyService handle errors
@Get(':id')
async getInquiry(@Param('id') id: string, @Headers('authorization') authHeader: string) {
  // No try/catch - ProxyService handles errors and preserves status codes
  return this.proxyService.proxyToInquiry('GET', `/api/v1/inquiries/${id}`, null, {
    Authorization: authHeader,
  });
}
```

---

## WebSocket Architecture

### Why WebSockets Don't Go Through BFF

**1. Protocol Difference**:
- HTTP REST uses request/response pattern
- WebSockets use persistent bidirectional connections
- Different protocols require different handling

**2. Stateful vs Stateless**:
- BFF is stateless (no connection state)
- WebSocket servers maintain connection state (rooms, participants)
- Maintaining state in BFF would violate its stateless design

**3. Performance**:
- Direct connections reduce latency
- No extra hop through BFF
- WebSocket servers can scale independently

**4. Socket.IO Features**:
- Rooms, namespaces, reconnection handled by Socket.IO
- These features work best with direct connections
- Proxying would add unnecessary complexity

### Frontend Implementation

```typescript
// Frontend connects directly to Inquiry Service
const socket = io(`${INQUIRY_SERVICE_WS_URL}/inquiry`, {
  auth: { token: accessToken }, // JWT token from BFF login
  transports: ['websocket', 'polling'],
});

// Join inquiry room
socket.emit('JOIN_INQUIRY', {
  inquiry_id: inquiryId,
  user_id: userId,
  user_role: userRole,
});

// Listen for messages
socket.on('MESSAGE_RECEIVED', (message) => {
  // Handle real-time message
});
```

### Authentication Flow

```
1. Frontend logs in via BFF
   POST /api/v1/auth/login
   → Receives: { accessToken: "..." }

2. Frontend stores token
   localStorage.setItem('accessToken', accessToken)

3. Frontend connects WebSocket directly to Inquiry Service
   io('http://localhost:3003/inquiry', { auth: { token: accessToken } })

4. Inquiry Service validates token
   - Verifies JWT signature
   - Checks expiration
   - Extracts user info

5. Connection established (or rejected if invalid)
```

---

## Summary

### Key Principles Applied

1. **DRY**: Single `proxyRequest` method used by all service-specific methods
2. **Separation of Concerns**: BFF only proxies, never makes business decisions
3. **Thin Controllers**: Controllers only route, don't contain logic
4. **Consistency**: Follows exact same patterns as Auth and Admin modules
5. **Stateless**: BFF maintains no state, no DB, no Redis
6. **WebSocket Separation**: WebSockets bypass BFF, connect directly to services

### Code Quality

- ✅ No code duplication
- ✅ Consistent error handling
- ✅ Predictable patterns
- ✅ Easy to test
- ✅ Easy to maintain
- ✅ Production-ready

### Architecture Benefits

- **Scalable**: Can add new services easily (just add wrapper method)
- **Maintainable**: Changes to proxy logic affect all services consistently
- **Testable**: Thin controllers are easy to test
- **Performant**: No unnecessary processing in BFF layer

---

**Last Updated**: 2024
**Related Documentation**: 
- [BFF Architecture Guide](./BFF_ARCHITECTURE.md)
- [WebSocket Guide](./WEBSOCKET_GUIDE.md)
- [Inquiry Service README](../inquiry/README.md)

