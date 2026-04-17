import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { AuthEventProducer } from '../kafka';
import {
  OAuthProvider,
  OAuthStartDto,
  OAuthStartResponseDto,
  OAuthCallbackDto,
  OAuthCallbackResponseDto,
  OAuthUserInfo,
  OAuthProviderConfig,
} from './dto/oauth.dto';
import { SessionResponseDto } from './dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * OAuth Service
 *
 * Handles OAuth 2.0 authentication flow:
 * - Start: Generate authorization URL for provider
 * - Callback: Exchange code for tokens, fetch user info, create/get user
 *
 * Supports: Google, GitHub (Apple can be added)
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly eventProducer: AuthEventProducer,
  ) { }

  /**
   * Get OAuth provider configuration
   * Throws error if provider is not configured
   */
  private getProviderConfig(provider: OAuthProvider): OAuthProviderConfig {
    const configs: Record<OAuthProvider, () => OAuthProviderConfig> = {
      google: () => ({
        clientId: this.configService.get<string>('GOOGLE_CLIENT_ID', ''),
        clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET', ''),
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scopes: ['openid', 'email', 'profile'],
      }),

      apple: () => ({
        clientId: this.configService.get<string>('APPLE_CLIENT_ID', ''),
        clientSecret: this.configService.get<string>('APPLE_CLIENT_SECRET', ''),
        authorizationUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        userInfoUrl: '', // Apple doesn't have a separate userinfo endpoint
        scopes: ['name', 'email'],
      }),
    };

    const config = configs[provider]();

    if (!config.clientId || !config.clientSecret) {
      this.logger.error(`OAuth provider ${provider} is not configured`);
      throw new BadRequestException(`OAuth provider '${provider}' is not configured`);
    }

    return config;
  }

  /**
   * Start OAuth flow - Generate authorization URL
   * POST /auth/oauth/:provider/start
   *
   * @param provider - OAuth provider (google, github, apple)
   * @param dto - Contains redirect_uri and state
   * @returns Authorization URL to redirect user
   */
  async startOAuth(
    provider: OAuthProvider,
    dto: OAuthStartDto,
  ): Promise<OAuthStartResponseDto> {
    this.logger.debug(`OAuth start for provider: ${provider}`);

    const config = this.getProviderConfig(provider);

    // Build authorization URL with query parameters
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: dto.redirect_uri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: dto.state,
    });

    // Provider-specific parameters
    if (provider === 'google') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }

    if (provider === 'apple') {
      params.append('response_mode', 'form_post');
    }

    const authorizationUrl = `${config.authorizationUrl}?${params.toString()}`;

    this.logger.log(`OAuth authorization URL generated for provider: ${provider}`);

    return { authorization_url: authorizationUrl };
  }

  /**
   * Handle OAuth callback - Exchange code for tokens and authenticate user
   * POST /auth/oauth/:provider/callback
   *
   * Flow:
   * 1. Exchange authorization code for access token
   * 2. Fetch user info from provider
   * 3. Find or create user in database
   * 4. Generate JWT session tokens
   *
   * @param provider - OAuth provider (google, apple)
   * @param dto - Contains code, state, and redirect_uri
   * @returns User ID, role, and session tokens (same as /auth/login)
   */
  async handleCallback(
    provider: OAuthProvider,
    dto: OAuthCallbackDto,
  ): Promise<OAuthCallbackResponseDto> {
    this.logger.debug(`OAuth callback for provider: ${provider}`);

    const config = this.getProviderConfig(provider);

    // Step 1: Exchange authorization code for access token
    const accessToken = await this.exchangeCodeForToken(provider, config, dto);

    // Step 2: Fetch user info from provider
    const userInfo = await this.fetchUserInfo(provider, config, accessToken);

    // Step 3: Find or create user in database
    const user = await this.findOrCreateUser(userInfo);

    // Step 4: Generate JWT session tokens
    const session = await this.createSession(user.id, user.email, user.role);

    this.logger.log(`OAuth login successful for user: ${user.id} (${user.email}) via ${provider}`);

    return {
      user_id: user.id,
      role: user.role,
      requires_mfa: false, // OAuth users don't go through MFA flow here
      session,
    };
  }

  /**
   * Exchange authorization code for access token
   * Makes POST request to provider's token endpoint
   */
  private async exchangeCodeForToken(
    provider: OAuthProvider,
    config: OAuthProviderConfig,
    dto: OAuthCallbackDto,
  ): Promise<string> {
    this.logger.debug(`Exchanging code for token with ${provider}`);

    try {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: dto.code,
        redirect_uri: dto.redirect_uri,
        grant_type: 'authorization_code',
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };



      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers,
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Token exchange failed: ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to exchange authorization code');
      }

      const data = await response.json();

      // Handle different response formats
      const accessToken = data.access_token;

      if (!accessToken) {
        this.logger.error(`No access_token in response: ${JSON.stringify(data)}`);
        throw new UnauthorizedException('Invalid authorization code');
      }

      return accessToken;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Token exchange error: ${error.message}`);
      throw new InternalServerErrorException('OAuth token exchange failed');
    }
  }

  /**
   * Fetch user info from OAuth provider
   * Uses access token to get user profile
   */
  private async fetchUserInfo(
    provider: OAuthProvider,
    config: OAuthProviderConfig,
    accessToken: string,
  ): Promise<OAuthUserInfo> {
    this.logger.debug(`Fetching user info from ${provider}`);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };



      const response = await fetch(config.userInfoUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`User info fetch failed: ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to fetch user information');
      }

      const data = await response.json();

      // Parse user info based on provider
      return this.parseUserInfo(provider, data, accessToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`User info fetch error: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch user information');
    }
  }

  /**
   * Parse user info from provider-specific response format
   */
  private async parseUserInfo(
    provider: OAuthProvider,
    data: any,
    accessToken: string,
  ): Promise<OAuthUserInfo> {
    switch (provider) {
      case 'google':
        return {
          email: data.email,
          name: data.name,
          picture: data.picture,
          sub: data.sub,
          provider,
        };



      case 'apple':
        // Apple returns user info in the ID token, not a separate endpoint
        return {
          email: data.email,
          name: data.name ? `${data.name.firstName || ''} ${data.name.lastName || ''}`.trim() : undefined,
          sub: data.sub,
          provider,
        };

      default:
        throw new BadRequestException(`Unsupported OAuth provider: ${provider}`);
    }
  }



  /**
   * Find existing user or create new user from OAuth info
   * Links OAuth provider to user account
   */
  private async findOrCreateUser(userInfo: OAuthUserInfo): Promise<{
    id: string;
    email: string;
    role: string;
  }> {
    this.logger.debug(`Finding or creating user for: ${userInfo.email}`);

    // First, check if user exists by OAuth provider + subject
    const existingCredential = await this.prisma.authCredential.findFirst({
      where: {
        oauthProvider: userInfo.provider,
        oauthSubject: userInfo.sub,
      },
      include: {
        user: true,
      },
    });

    if (existingCredential) {
      this.logger.debug(`Found existing OAuth user: ${existingCredential.user.id}`);
      return {
        id: existingCredential.user.id,
        email: existingCredential.user.email,
        role: existingCredential.user.role,
      };
    }

    // Check if user exists by email (may have registered with password)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userInfo.email.toLowerCase() },
      include: { authCredential: true },
    });

    if (existingUser) {
      // User exists - link OAuth provider to existing account
      if (existingUser.authCredential) {
        // Update existing auth credential with OAuth info
        await this.prisma.authCredential.update({
          where: { userId: existingUser.id },
          data: {
            oauthProvider: userInfo.provider,
            oauthSubject: userInfo.sub,
          },
        });
      } else {
        // Create auth credential with OAuth info
        await this.prisma.authCredential.create({
          data: {
            userId: existingUser.id,
            oauthProvider: userInfo.provider,
            oauthSubject: userInfo.sub,
          },
        });
      }

      this.logger.log(`Linked OAuth provider ${userInfo.provider} to existing user: ${existingUser.id}`);

      return {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      };
    }

    // Create new user with OAuth credentials
    const newUser = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: userInfo.email.toLowerCase(),
          role: 'user', // Default role for OAuth users
        },
      });

      // Create auth credentials with OAuth info (no password)
      await tx.authCredential.create({
        data: {
          userId: user.id,
          oauthProvider: userInfo.provider,
          oauthSubject: userInfo.sub,
          // No password for OAuth-only users
        },
      });

      // Create user profile
      await tx.userProfile.create({
        data: {
          userId: user.id,
          kycStatus: 'not_started',
          displayName: userInfo.name || undefined,
        },
      });

      // Create KYC status record
      await tx.kycStatus.create({
        data: {
          userId: user.id,
          status: 'not_started',
        },
      });

      return user;
    });

    this.logger.log(`Created new OAuth user: ${newUser.id} (${newUser.email}) via ${userInfo.provider}`);

    // Emit user.created event
    await this.eventProducer.userCreated(
      newUser.id,
      newUser.email,
      newUser.role,
      userInfo.name,
    );

    return {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
  }

  /**
   * Create a new session and generate tokens
   * Same as AuthService.createSession - duplicated to avoid circular dependency
   */
  private async createSession(
    userId: string,
    email: string,
    role: string,
    device?: { name?: string; ip?: string },
  ): Promise<SessionResponseDto> {
    // Generate tokens first (we need refresh token to store in session)
    const sessionId = uuidv4();

    const refreshToken = this.jwtService.generateRefreshToken(userId, sessionId);

    // Create session in Redis
    await this.sessionService.createSession(userId, sessionId, refreshToken, device);

    // Emit session.created event
    await this.eventProducer.sessionCreated(sessionId, userId, email, device);

    // Generate access token
    const accessToken = this.jwtService.generateAccessToken(
      userId,
      email,
      role,
      sessionId,
    );

    return {
      accessToken,
      accessExpiresIn: this.jwtService.getAccessTokenExpirySeconds(),
      refreshToken,
      refreshExpiresIn: this.jwtService.getRefreshTokenExpirySeconds(),
    };
  }
}
