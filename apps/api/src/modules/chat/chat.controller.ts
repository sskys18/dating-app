import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('start')
  @ApiOperation({ summary: 'Create or resume a chat session' })
  async startChat(@Req() req: Request) {
    const sessionId = this.getSessionId(req);
    return this.chatService.startChat(sessionId);
  }

  @Post('message')
  @ApiOperation({ summary: 'Send a message and get AI response' })
  async sendMessage(
    @Req() req: Request,
    @Body() body: { content: string },
  ) {
    const sessionId = this.getSessionId(req);
    return this.chatService.sendMessage(sessionId, body.content);
  }

  @Get('session')
  @ApiOperation({ summary: 'Get current chat session state' })
  async getSession(@Req() req: Request) {
    const sessionId = this.getSessionId(req);
    return this.chatService.getSession(sessionId);
  }

  private getSessionId(req: Request): string {
    const sessionId = req.cookies?.['anon_session_id'];
    if (!sessionId) {
      throw new BadRequestException(
        'No anonymous session found. Please start from the landing page.',
      );
    }
    return sessionId;
  }
}
