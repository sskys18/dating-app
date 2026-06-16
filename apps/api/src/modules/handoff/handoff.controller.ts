import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';
import { HandoffService } from './handoff.service';

@ApiTags('handoff')
@Controller('handoff')
export class HandoffController {
  constructor(private handoffService: HandoffService) {}

  @Post('request')
  @ApiOperation({ summary: 'Request a handoff token for the current session' })
  async requestToken(@Req() req: Request) {
    const sessionId = req.cookies?.['anon_session_id'];
    if (!sessionId) {
      throw new BadRequestException('No anonymous session found');
    }
    return this.handoffService.generateToken(sessionId);
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Claim a handoff token and transfer session data' })
  async claimToken(
    @Req() req: Request,
    @Body() body: { token: string },
  ) {
    const userId = req.user!.id;
    return this.handoffService.claimToken(body.token, userId);
  }
}
