import { Controller, Get, Post, Body, Query, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { QuizService } from './quiz.service';

@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private quizService: QuizService) {}

  @Get('items')
  @ApiOperation({ summary: 'Get all quiz items' })
  getItems() {
    return { items: this.quizService.getItems() };
  }

  @Get('result')
  @ApiOperation({ summary: 'Get quiz result for current session' })
  async getResult(@Req() req: Request, @Query('locale') locale?: string) {
    const sessionId = this.getSessionId(req);
    return this.quizService.getResult(sessionId, locale);
  }

  @Post('progress')
  @ApiOperation({ summary: 'Save quiz progress' })
  async saveProgress(
    @Req() req: Request,
    @Body() body: { progress: { answers: (number | null)[]; currentIndex: number } },
  ) {
    const sessionId = this.getSessionId(req);
    return this.quizService.saveProgress(sessionId, body.progress);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit quiz answers and compute type' })
  async submit(
    @Req() req: Request,
    @Body() body: { answers: number[] },
    @Query('locale') locale?: string,
  ): Promise<Record<string, unknown>> {
    const sessionId = this.getSessionId(req);
    return this.quizService.submit(sessionId, body.answers, locale) as Promise<Record<string, unknown>>;
  }

  private getSessionId(req: Request): string {
    const sessionId = req.cookies?.['anon_session_id'];
    if (!sessionId) {
      throw new BadRequestException('No anonymous session found. Please start from the landing page.');
    }
    return sessionId;
  }
}
