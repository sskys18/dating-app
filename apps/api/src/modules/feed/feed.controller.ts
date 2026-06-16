import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedService } from './feed.service';
import type { LikeDto } from './dto/like.dto';
import type { IncognitoDto } from './dto/incognito.dto';
import type { TravelDto } from './dto/travel.dto';

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

  @Get('likes-you')
  async getLikesYou(@Req() req: Request) {
    return this.feedService.getLikesYou(req.user!.id);
  }

  @Post('rewind')
  async rewind(@Req() req: Request) {
    return this.feedService.rewind(req.user!.id);
  }

  @Put('incognito')
  async setIncognito(@Req() req: Request, @Body() dto: IncognitoDto) {
    return this.feedService.setIncognito(req.user!.id, dto.enabled);
  }

  @Put('travel')
  async setTravel(@Req() req: Request, @Body() dto: TravelDto) {
    if (dto.active && (dto.lat === undefined || dto.lng === undefined)) {
      throw new BadRequestException('lat and lng are required when active=true');
    }
    return this.feedService.setTravel(
      req.user!.id,
      dto.active ? { lat: dto.lat!, lng: dto.lng! } : null,
    );
  }

  @Delete('travel')
  async clearTravel(@Req() req: Request) {
    return this.feedService.setTravel(req.user!.id, null);
  }
}
