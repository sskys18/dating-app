import { Controller, Get, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PreviewService } from './preview.service';

@ApiTags('preview')
@Controller('preview')
export class PreviewController {
  constructor(private previewService: PreviewService) {}

  @Get('matches')
  @ApiOperation({ summary: 'Get 3 synthetic match profiles for current session' })
  async getMatches(@Req() req: Request) {
    const sessionId = req.cookies?.['anon_session_id'];
    if (!sessionId) {
      throw new BadRequestException('No anonymous session found. Please start from the landing page.');
    }
    return this.previewService.getMatches(sessionId);
  }
}
