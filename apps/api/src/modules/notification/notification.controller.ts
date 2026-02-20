import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Post('register')
  async registerToken(
    @Req() req: Request,
    @Body() body: { token: string; platform: string },
  ) {
    await this.notificationService.registerToken(
      req.user!.id,
      body.token,
      body.platform,
    );
    return { success: true };
  }

  @Delete('unregister')
  async unregisterToken(@Body() body: { token: string }) {
    await this.notificationService.unregisterToken(body.token);
    return { success: true };
  }
}
