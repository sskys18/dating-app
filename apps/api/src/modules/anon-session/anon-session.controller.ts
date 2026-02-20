import { Controller, Post, Get, Param, Req, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AnonSessionService } from './anon-session.service';

@ApiTags('anon-session')
@Controller('anon-sessions')
export class AnonSessionController {
  constructor(private anonSessionService: AnonSessionService) {}

  @Post()
  @ApiOperation({ summary: 'Create anonymous session' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en-US', 'ko-KR'] })
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('locale') locale?: string,
  ) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    const sessionLocale = locale === 'ko-KR' ? 'ko-KR' : 'en-US';

    const session = await this.anonSessionService.create(ip, userAgent, sessionLocale);

    // Set HttpOnly cookie for session tracking
    res.cookie('anon_session_id', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24h
      path: '/',
    });

    return {
      id: session.id,
      locale: session.locale,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current anonymous session from cookie' })
  async getCurrent(@Req() req: Request): Promise<Record<string, unknown>> {
    const sessionId = req.cookies?.['anon_session_id'];
    if (!sessionId) {
      return { error: 'No session', id: null };
    }
    const session = await this.anonSessionService.findById(sessionId);
    if (!session) {
      return { error: 'Session not found or expired', id: null };
    }
    return {
      id: session.id,
      locale: session.locale,
      expiresAt: session.expiresAt.toISOString(),
      hasQuizResponse: !!session.quizResponse?.completedAt,
      hasChatSession: !!session.chatSession,
      quizProgress: session.quizResponse?.progress || null,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get anonymous session by ID' })
  async findOne(@Param('id') id: string): Promise<Record<string, unknown>> {
    const session = await this.anonSessionService.findById(id);
    if (!session) {
      return { error: 'Session not found or expired' };
    }

    return {
      id: session.id,
      locale: session.locale,
      expiresAt: session.expiresAt.toISOString(),
      hasQuizResponse: !!session.quizResponse?.completedAt,
      hasChatSession: !!session.chatSession,
      quizProgress: session.quizResponse?.progress || null,
    };
  }
}
