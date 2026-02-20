import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { BlockService } from './block.service';
import type { BlockUserDto } from './dto/block-user.dto';

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlockController {
  constructor(private blockService: BlockService) {}

  @Post()
  async blockUser(@Req() req: Request, @Body() dto: BlockUserDto) {
    await this.blockService.blockUser(req.user!.id, dto.blockedId);
    return { success: true };
  }

  @Delete(':blockedId')
  async unblockUser(@Req() req: Request, @Param('blockedId') blockedId: string) {
    await this.blockService.unblockUser(req.user!.id, blockedId);
    return { success: true };
  }

  @Get()
  async getBlockList(@Req() req: Request) {
    return this.blockService.getBlockList(req.user!.id);
  }
}
