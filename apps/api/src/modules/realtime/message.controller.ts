import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { DatingChatService } from './dating-chat.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private chatService: DatingChatService) {}

  @Get('matches')
  async getMatchList(@Req() req: Request) {
    return this.chatService.getMatchList(req.user!.id);
  }

  @Get(':chatRoomId')
  async getChatRoom(
    @Req() req: Request,
    @Param('chatRoomId') chatRoomId: string,
  ) {
    return this.chatService.getChatRoom(chatRoomId, req.user!.id);
  }

  @Get(':chatRoomId/messages')
  async getMessages(
    @Req() req: Request,
    @Param('chatRoomId') chatRoomId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(
      chatRoomId,
      req.user!.id,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
