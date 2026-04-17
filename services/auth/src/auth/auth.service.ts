import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { AuthEventProducer } from '../kafka';
import {
  SignupDto,
  LoginDto,
  SignupResponseDto,
  LoginResponseDto,
  RefreshResponseDto,
  SessionResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorVerifyResponseDto,
  TwoFactorDisableResponseDto,
  TwoFactorStatusResponseDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
  ChangePasswordResponseDto,
  UpdateProfileDto,
  UpdateProfileResponseDto,
} from './dto';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

/**
 * Auth Service
 *
 * Handles user authentication:
 * - Signup: Create user, hash password, issue tokens
 * - Login: Validate credentials, issue tokens
 * - Token refresh: Rotate refresh tokens
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly eventProducer: AuthEventProducer,
  ) { }

  /**
   * Register a new user
   */
  async signup(dto: SignupDto): Promise<SignupResponseDto> {
    this.logger.debug(`Signup attempt for email: ${dto.email}`);

    // Validate terms acceptance
    if (!dto.acceptTerms) {
      throw new BadRequestException('You must accept the terms and conditions');
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password using Argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create user with related records in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Create user (only fields that exist on User model)
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          role: 'user', // Default role for all new signups
        },
      });

      // Create auth credentials
      await tx.authCredential.create({
        data: {
          userId: newUser.id,
          passwordHash,
          passwordAlgo: 'argon2id',
        },
      });

      // Create user profile (contains profile-related fields)
      await tx.userProfile.create({
        data: {
          userId: newUser.id,
          kycStatus: 'not_started',
          displayName: dto.displayName,
          companyName: dto.companyName,
          companyRepresentativeName: dto.companyRepresentativeName,
          companyBillingAddress: dto.companyBillingAddress,
          primaryPhone: dto.primaryPhone,
          preferredLanguage: dto.preferredLanguage || 'en',
        },
      });

      // Create KYC status record
      await tx.kycStatus.create({
        data: {
          userId: newUser.id,
          status: 'not_started',
        },
      });

      return newUser;
    });

    this.logger.log(`User created: ${user.id} (${user.email})`);

    // Generate tokens
    const session = await this.createSession(user.id, user.email, user.role);

    // Emit user.created event to outbox
    await this.eventProducer.userCreated(
      user.id,
      user.email,
      user.role,
      dto.displayName,
    );

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      kyc: {
        state: 'not_started',
        updatedAt: user.createdAt.toISOString(),
      },
      session,
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    this.logger.debug(`Login attempt for email: ${dto.email}`);

    // Find user with credentials and profile
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        authCredential: true,
        userProfile: true,
      },
    });

    if (!user || !user.authCredential) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is soft deleted
    if (user.deletedAt) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Check user account status BEFORE password verification
    const userStatus = user.userProfile?.status?.toLowerCase() || 'active';

    if (userStatus === 'locked') {
      throw new UnauthorizedException(
        'Your account has been locked. Please contact support.',
      );
    }

    // Verify password
    const isPasswordValid = await argon2.verify(
      user.authCredential.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check MFA and store the status
    const isMfaEnabled = user.authCredential?.mfaEnabled || false;

    if (isMfaEnabled) {
      if (!dto.mfaCode) {
        // MFA is enabled but code not provided - return early without session
        return {
          userId: user.id,
          role: user.role,
          requiresMfa: true,
          mfaEnabled: true,
        };
      }

      // Validate MFA code
      const isValidMfa = await this.validateMfaCode(user.id, dto.mfaCode);
      if (!isValidMfa) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // At this point, authentication is complete (either no MFA or MFA verified)
    // Generate tokens
    const session = await this.createSession(
      user.id,
      user.email,
      user.role,
      dto.device,
    );

    this.logger.log(`User logged in: ${user.id} (${user.email})`);

    // TODO: Publish user.session.created event

    return {
      userId: user.id,
      role: user.role,
      requiresMfa: false, // Authentication complete, no more MFA needed
      mfaEnabled: isMfaEnabled, // Indicates if MFA was used
      session,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
    device?: { name?: string; ip?: string },
  ): Promise<RefreshResponseDto> {
    // Verify refresh token
    const payload = this.jwtService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Get user to ensure they still exist and are active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { userProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user is soft deleted
    if (user.deletedAt) {
      throw new UnauthorizedException('Account is not active');
    }

    // Check user account status
    const userStatus = user.userProfile?.status?.toLowerCase() || 'active';

    if (userStatus === 'locked') {
      throw new UnauthorizedException(
        'Your account has been locked. Please contact support.',
      );
    }

    // Generate new tokens
    const newRefreshToken = this.jwtService.generateRefreshToken(
      user.id,
      payload.sessionId,
    );

    // Rotate refresh token in session
    const session = await this.sessionService.rotateRefreshToken(
      payload.sessionId,
      refreshToken,
      newRefreshToken,
      device,
    );

    if (!session) {
      // Reuse detected or session not found
      throw new UnauthorizedException('Session invalid. Please login again.');
    }

    // Generate new access token
    const accessToken = this.jwtService.generateAccessToken(
      user.id,
      user.email,
      user.role,
      payload.sessionId,
    );

    return {
      accessToken,
      accessExpiresIn: this.jwtService.getAccessTokenExpirySeconds(),
      refreshToken: newRefreshToken,
      refreshExpiresIn: this.jwtService.getRefreshTokenExpirySeconds(),
    };
  }

  /**
   * Logout current session
   */
  async logout(sessionId: string, userId?: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId);

    // Emit session.revoked event if userId provided
    if (userId) {
      await this.eventProducer.sessionRevoked(sessionId, userId, 'user_logout');
    }

    this.logger.debug(`Session revoked: ${sessionId}`);
  }

  /**
   * Logout all sessions for a user
   */
  async logoutAll(userId: string): Promise<number> {
    const count = await this.sessionService.revokeAllUserSessions(userId);
    this.logger.debug(`Revoked ${count} sessions for user ${userId}`);
    return count;
  }

  /**
   * Get user by ID with profile and KYC status
   */
  async getUserById(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        kycStatusRecord: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check user account status
    const userStatus = user.userProfile?.status?.toLowerCase() || 'active';

    if (userStatus === 'locked') {
      throw new UnauthorizedException(
        'Your account has been locked. Please contact support.',
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: !user.deletedAt,
      profile: user.userProfile
        ? {
          displayName: user.userProfile.displayName,
          companyName: user.userProfile.companyName,
          companyRepresentativeName:
            user.userProfile.companyRepresentativeName,
          companyBillingAddress: user.userProfile.companyBillingAddress,
          preferredLanguage: user.userProfile.preferredLanguage,
          primaryPhone: user.userProfile.primaryPhone,
        }
        : null,
      kycStatus: user.kycStatusRecord
        ? {
          state: user.kycStatusRecord.status,
          level: user.kycStatusRecord.level,
          updatedAt: user.kycStatusRecord.updatedAt,
        }
        : user.userProfile
          ? {
            state: user.userProfile.kycStatus,
            updatedAt: user.userProfile.updatedAt,
          }
          : null,
    };
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdateProfileResponseDto> {
    this.logger.debug(`Profile update request for user: ${userId}`);

    // Get user to ensure they exist
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user is deleted
    if (user.deletedAt) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Update user profile
    const updatedProfile = await this.prisma.userProfile.update({
      where: { userId: userId },
      data: {
        displayName:
          dto.displayName !== undefined
            ? dto.displayName
            : user.userProfile?.displayName,
        primaryPhone:
          dto.primaryPhone !== undefined
            ? dto.primaryPhone
            : user.userProfile?.primaryPhone,
        companyName:
          dto.companyName !== undefined
            ? dto.companyName
            : user.userProfile?.companyName,
        companyRepresentativeName:
          dto.companyRepresentativeName !== undefined
            ? dto.companyRepresentativeName
            : user.userProfile?.companyRepresentativeName,
        companyBillingAddress:
          dto.companyBillingAddress !== undefined
            ? dto.companyBillingAddress
            : user.userProfile?.companyBillingAddress,
        preferredLanguage:
          dto.preferredLanguage !== undefined
            ? dto.preferredLanguage
            : user.userProfile?.preferredLanguage,
      },
    });

    this.logger.log(`Profile updated for user: ${userId}`);

    return {
      message: 'Profile updated successfully',
      profile: {
        displayName: updatedProfile.displayName,
        primaryPhone: updatedProfile.primaryPhone,
        companyName: updatedProfile.companyName,
        companyRepresentativeName: updatedProfile.companyRepresentativeName,
        companyBillingAddress: updatedProfile.companyBillingAddress,
        preferredLanguage: updatedProfile.preferredLanguage,
      },
    };
  }

  // ====================================
  // Two-Factor Authentication Methods
  // ====================================

  /**
   * Setup 2FA for a user - generates secret and QR code
   */
  async setup2FA(userId: string): Promise<TwoFactorSetupResponseDto> {
    this.logger.debug(`2FA setup request for user: ${userId}`);

    // Get user with credentials
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authCredential: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if 2FA is already enabled
    if (user.authCredential?.mfaEnabled) {
      throw new BadRequestException(
        '2FA is already enabled. Disable it first to set up a new one.',
      );
    }

    // Generate a new secret
    const secret = authenticator.generateSecret();

    // Generate otpauth URL for authenticator apps (kept server-side)
    const otpauthUrl = authenticator.keyuri(user.email, 'Escrowly', secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store the secret securely (encrypted in production)
    // The secret is not enabled yet - it will be enabled after verification
    await this.prisma.authCredential.update({
      where: { userId: userId },
      data: {
        mfaSecretEncrypted: secret, // TODO: Encrypt with KMS in production
        mfaType: 'totp',
        // mfaEnabled remains false until verified
      },
    });

    this.logger.log(`2FA setup initiated for user: ${userId}`);

    // Return ONLY the QR code data URL
    // Do NOT expose secret or otpauthUrl to the client
    return {
      qrCodeDataUrl,
    };
  }

  /**
   * Verify 2FA code and enable 2FA for the user
   */
  async verify2FA(
    userId: string,
    code: string,
  ): Promise<TwoFactorVerifyResponseDto> {
    this.logger.debug(`2FA verification for user: ${userId}`);

    // Get user with credentials
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authCredential: true },
    });

    if (!user || !user.authCredential) {
      throw new UnauthorizedException('User not found');
    }

    // Check if secret exists (setup was initiated)
    if (!user.authCredential.mfaSecretEncrypted) {
      throw new BadRequestException(
        '2FA setup not initiated. Please call setup endpoint first.',
      );
    }

    // Check if 2FA is already enabled
    if (user.authCredential.mfaEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Verify the code
    const isValid = authenticator.verify({
      token: code,
      secret: user.authCredential.mfaSecretEncrypted,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Enable 2FA
    await this.prisma.authCredential.update({
      where: { userId: userId },
      data: {
        mfaEnabled: true,
      },
    });

    this.logger.log(`2FA enabled for user: ${userId}`);

    return {
      enabled: true,
      message: 'Two-factor authentication enabled successfully',
    };
  }

  /**
   * Disable 2FA for the user
   */
  async disable2FA(
    userId: string,
    code: string,
  ): Promise<TwoFactorDisableResponseDto> {
    this.logger.debug(`2FA disable request for user: ${userId}`);

    // Get user with credentials
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authCredential: true },
    });

    if (!user || !user.authCredential) {
      throw new UnauthorizedException('User not found');
    }

    // Check if 2FA is enabled
    if (!user.authCredential.mfaEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify the code before disabling
    const isValid = authenticator.verify({
      token: code,
      secret: user.authCredential.mfaSecretEncrypted,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Disable 2FA and clear the secret
    await this.prisma.authCredential.update({
      where: { userId: userId },
      data: {
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaType: null,
      },
    });

    this.logger.log(`2FA disabled for user: ${userId}`);

    return {
      enabled: false,
      message: 'Two-factor authentication disabled successfully',
    };
  }

  /**
   * Get 2FA status for the user
   */
  async get2FAStatus(userId: string): Promise<TwoFactorStatusResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authCredential: true },
    });

    if (!user || !user.authCredential) {
      throw new UnauthorizedException('User not found');
    }

    return {
      enabled: user.authCredential.mfaEnabled,
      type: user.authCredential.mfaType || undefined,
    };
  }

  /**
   * Validate MFA code during login
   */
  async validateMfaCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authCredential: true },
    });

    if (
      !user ||
      !user.authCredential ||
      !user.authCredential.mfaSecretEncrypted
    ) {
      return false;
    }

    return authenticator.verify({
      token: code,
      secret: user.authCredential.mfaSecretEncrypted,
    });
  }

  /**
   * Consume a backup code for 2FA
   * Used when user cannot access their authenticator app
   */
  async consumeBackupCode(userId: string, code: string): Promise<boolean> {
    this.logger.debug(`Backup code consume attempt for user: ${userId}`);

    // Get user with credentials
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authCredential: true },
    });

    if (!user || !user.authCredential) {
      throw new UnauthorizedException('User not found');
    }

    // Check if 2FA is enabled
    if (!user.authCredential.mfaEnabled) {
      throw new BadRequestException('2FA is not enabled for this account');
    }

    // Normalize the code (uppercase, remove spaces/dashes)
    const normalizedCode = code.toUpperCase().replace(/[\s-]/g, '');

    // Get all unused backup codes for this user
    const backupCodes = await this.prisma.twoFactorBackupCode.findMany({
      where: {
        userId: user.authCredential.userId,
        usedAt: null,
      },
    });

    if (backupCodes.length === 0) {
      throw new UnauthorizedException('No unused backup codes available');
    }

    // Try to find a matching backup code
    let matchedCode = null;
    for (const backupCode of backupCodes) {
      // Verify the code against the hash
      const isValid = await argon2.verify(backupCode.codeHash, normalizedCode);
      if (isValid) {
        matchedCode = backupCode;
        break;
      }
    }

    if (!matchedCode) {
      throw new UnauthorizedException('Invalid backup code');
    }

    // Mark the backup code as used
    await this.prisma.twoFactorBackupCode.update({
      where: { id: matchedCode.id },
      data: { usedAt: new Date() },
    });

    this.logger.log(`Backup code consumed successfully for user: ${userId}`);

    return true;
  }

  // ====================================
  // Password Reset Methods
  // ====================================

  /**
   * Request password reset - sends reset token
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponseDto> {
    this.logger.debug(`Password reset request for email: ${email}`);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { authCredential: true },
    });

    // If user doesn't exist or is deleted
    if (!user || user.deletedAt) {
      this.logger.warn(
        `Password reset requested for non-existent user: ${email}`,
      );
      throw new BadRequestException('Email is not exist');
    }

    // Check if user has password (not OAuth-only user)
    if (!user.authCredential || !user.authCredential.passwordHash) {
      this.logger.warn(
        `Password reset requested for OAuth-only user: ${email}`,
      );
      throw new BadRequestException(
        'Password reset not available for this account',
      );
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store reset token in database
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.authCredential.userId,
        token: hashedToken,
        expiresAt,
      },
    });

    this.logger.log(`Password reset token created for user: ${user.id}`);

    // Emit password reset requested event to Kafka
    // Notification service will consume this and send the email
    await this.eventProducer.passwordResetRequested(
      user.id,
      user.email,
      resetToken,
      expiresAt,
    );

    this.logger.log(`Password reset event emitted for user: ${user.id}`);

    return {
      message: 'Password reset link has been sent to your email',
    };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<ResetPasswordResponseDto> {
    this.logger.debug('Password reset attempt with token');

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        authCredential: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if user is deleted
    if (resetToken.authCredential.user.deletedAt) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Update password and mark token as used in a transaction
    await this.prisma.$transaction([
      // Update password
      this.prisma.authCredential.update({
        where: { userId: resetToken.userId },
        data: {
          passwordHash,
          passwordAlgo: 'argon2id',
          lastPasswordRotatedAt: new Date(),
        },
      }),
      // Mark token as used
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Revoke all existing sessions for security
    await this.sessionService.revokeAllUserSessions(resetToken.userId);

    // Emit password changed event to Kafka
    // Notification service will consume this and send the confirmation email
    await this.eventProducer.passwordChanged(
      resetToken.userId,
      resetToken.authCredential.user.email,
      'reset',
    );

    this.logger.log(`Password reset successful for user: ${resetToken.userId}`);

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResponseDto> {
    this.logger.debug(`Password change request for user: ${userId}`);

    // Get user with credentials
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authCredential: true },
    });

    if (!user || !user.authCredential) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user is deleted
    if (user.deletedAt) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Verify current password
    if (!user.authCredential.passwordHash) {
      throw new BadRequestException(
        'Password change not available for OAuth users',
      );
    }

    const isPasswordValid = await argon2.verify(
      user.authCredential.passwordHash,
      currentPassword,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check if new password is same as current
    const isSamePassword = await argon2.verify(
      user.authCredential.passwordHash,
      newPassword,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Update password
    await this.prisma.authCredential.update({
      where: { userId: userId },
      data: {
        passwordHash,
        passwordAlgo: 'argon2id',
        lastPasswordRotatedAt: new Date(),
      },
    });

    // Emit password changed event to Kafka
    // Notification service will consume this and send the confirmation email
    await this.eventProducer.passwordChanged(user.id, user.email, 'user_change');

    this.logger.log(`Password changed successfully for user: ${userId}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Create a new session and generate tokens
   */
  private async createSession(
    userId: string,
    email: string,
    role: string,
    device?: { name?: string; ip?: string },
  ): Promise<SessionResponseDto> {
    // Generate tokens first (we need refresh token to store in session)
    const sessionId = uuidv4();

    const refreshToken = this.jwtService.generateRefreshToken(
      userId,
      sessionId,
    );

    // Create session in Redis (pass sessionId to ensure JWT and Redis match)
    await this.sessionService.createSession(
      userId,
      sessionId,
      refreshToken,
      device,
    );

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
