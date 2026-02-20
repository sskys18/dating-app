import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { PrismaService } from '@/modules/prisma/prisma.service';
import type { RedisService } from '@/modules/redis/redis.service';

interface ProviderUserInfo {
  providerUid: string;
  email: string | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string | null;
    nickname: string | null;
    profileComplete: boolean;
    role: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appleJwksClient: jwksClient.JwksClient;
  private readonly googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.appleJwksClient = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      cacheMaxAge: 86400000, // 24h
    });

    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async authenticate(
    provider: string,
    idToken: string,
  ): Promise<AuthTokens> {
    const userInfo = await this.verifyProviderToken(provider, idToken);

    const user = await this.findOrCreateUser(
      provider,
      userInfo.providerUid,
      userInfo.email,
    );

    return this.generateTokenPair(user);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; jti: string; type: string };

    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const isRevoked = await this.redis.get(`revoked:${payload.jti}`);
    if (isRevoked) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Revoke the old refresh token
    const ttl = this.config.get<number>('JWT_REFRESH_TTL', 604800);
    await this.redis.set(`revoked:${payload.jti}`, '1', 'EX', ttl);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        profileComplete: true,
        status: true,
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.generateTokenPair(user);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwt.verify<{ jti: string; exp: number }>(
        refreshToken,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET') },
      );

      const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        await this.redis.set(
          `revoked:${payload.jti}`,
          '1',
          'EX',
          remainingTtl,
        );
      }
    } catch {
      // Token already expired or invalid — nothing to revoke
    }
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async verifyProviderToken(
    provider: string,
    idToken: string,
  ): Promise<ProviderUserInfo> {
    switch (provider) {
      case 'apple':
        return this.verifyAppleToken(idToken);
      case 'google':
        return this.verifyGoogleToken(idToken);
      case 'kakao':
        return this.verifyKakaoToken(idToken);
      default:
        throw new UnauthorizedException(`Unsupported provider: ${provider}`);
    }
  }

  private async verifyAppleToken(idToken: string): Promise<ProviderUserInfo> {
    try {
      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded || !decoded.header.kid) {
        throw new Error('Invalid token structure');
      }

      const key = await this.appleJwksClient.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(idToken, publicKey, {
        issuer: 'https://appleid.apple.com',
        audience: this.config.get<string>('APPLE_CLIENT_ID'),
        algorithms: ['RS256'],
      }) as jwt.JwtPayload;

      return {
        providerUid: payload.sub as string,
        email: (payload.email as string) || null,
      };
    } catch (error) {
      this.logger.error('Apple token verification failed', error);
      throw new UnauthorizedException('Invalid Apple ID token');
    }
  }

  private async verifyGoogleToken(idToken: string): Promise<ProviderUserInfo> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        throw new Error('Missing payload');
      }

      return {
        providerUid: payload.sub,
        email: payload.email || null,
      };
    } catch (error) {
      this.logger.error('Google token verification failed', error);
      throw new UnauthorizedException('Invalid Google ID token');
    }
  }

  private async verifyKakaoToken(accessToken: string): Promise<ProviderUserInfo> {
    try {
      const response = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Kakao API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        id: number;
        kakao_account?: { email?: string };
      };

      return {
        providerUid: String(data.id),
        email: data.kakao_account?.email || null,
      };
    } catch (error) {
      this.logger.error('Kakao token verification failed', error);
      throw new UnauthorizedException('Invalid Kakao access token');
    }
  }

  private async findOrCreateUser(
    provider: string,
    providerUid: string,
    email: string | null,
  ) {
    // 1. Check if this provider account already exists
    const existingProvider = await this.prisma.authProvider.findUnique({
      where: { provider_providerUid: { provider, providerUid } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            profileComplete: true,
          },
        },
      },
    });

    if (existingProvider) {
      return existingProvider.user;
    }

    // 2. If email exists, link to existing user
    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          nickname: true,
          role: true,
          profileComplete: true,
        },
      });

      if (existingUser) {
        await this.prisma.authProvider.create({
          data: { userId: existingUser.id, provider, providerUid, email },
        });
        return existingUser;
      }
    }

    // 3. Create new user + provider in a transaction
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email },
        select: {
          id: true,
          email: true,
          nickname: true,
          role: true,
          profileComplete: true,
        },
      });

      await tx.authProvider.create({
        data: { userId: user.id, provider, providerUid, email },
      });

      return user;
    });
  }

  private async generateTokenPair(user: {
    id: string;
    email: string | null;
    nickname: string | null;
    role: string;
    profileComplete: boolean;
  }): Promise<AuthTokens> {
    const accessTtl = this.config.get<number>('JWT_ACCESS_TTL', 900);
    const refreshTtl = this.config.get<number>('JWT_REFRESH_TTL', 604800);
    const jti = crypto.randomUUID();

    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
      },
      { expiresIn: accessTtl },
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, jti, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );

    // Store refresh token hash in Redis for tracking
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    await this.redis.set(`refresh:${user.id}:${jti}`, tokenHash, 'EX', refreshTtl);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        profileComplete: user.profileComplete,
        role: user.role,
      },
    };
  }
}
