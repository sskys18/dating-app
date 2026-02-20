import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ProfileService } from './profile.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    return this.profileService.getProfile(req.user!.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req: Request) {
    return this.profileService.updateProfile(req.user!.id, dto);
  }

  @Get('drafts')
  @UseGuards(JwtAuthGuard)
  async getDrafts(@Req() req: Request) {
    return this.profileService.getDrafts(req.user!.id);
  }
}
