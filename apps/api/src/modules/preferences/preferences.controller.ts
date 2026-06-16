import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PreferencesService } from './preferences.service';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('preferences')
@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private preferencesService: PreferencesService) {}

  @Get()
  async getPreferences(@Req() req: Request) {
    return this.preferencesService.getPreferences(req.user!.id);
  }

  @Put()
  async updatePreferences(@Req() req: Request, @Body() dto: UpdatePreferencesDto) {
    return this.preferencesService.updatePreferences(req.user!.id, dto);
  }
}
