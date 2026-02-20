import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  Res,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      body.refreshToken || req.cookies?.['refresh_token'];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refreshTokens(refreshToken);

    if (!body.refreshToken) {
      // Web: came from cookie, set new cookie
      this.setRefreshCookie(res, result.refreshToken);
      return {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      };
    }

    // iOS: return refresh token in body
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      body.refreshToken || req.cookies?.['refresh_token'];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { success: true };
  }

  @Post(':provider')
  @ApiOperation({ summary: 'Authenticate with social provider' })
  async authenticate(
    @Param('provider') provider: string,
    @Body() body: { idToken: string },
    @Query('platform') platform: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.authenticate(
      provider,
      body.idToken,
    );

    if (platform !== 'ios') {
      this.setRefreshCookie(res, result.refreshToken);
      return {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      };
    }

    // iOS gets the refresh token in the response body
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    const ttl = this.config.get<number>('JWT_REFRESH_TTL', 604800);
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: ttl * 1000,
    });
  }
}
