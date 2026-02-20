import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { FeedService } from './feed.service';
import type { LikeDto } from './dto/like.dto';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Get()
  async getFeed(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getFeed(
      req.user!.id,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('like')
  async likeOrPass(@Req() req: Request, @Body() dto: LikeDto) {
    return this.feedService.likeOrPass(req.user!.id, dto.targetUserId, dto.action);
  }

  @Get('quota')
  async getQuota(@Req() req: Request) {
    return this.feedService.getQuota(req.user!.id);
  }
}
