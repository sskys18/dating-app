import {
  Controller,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PhotoService } from './photo.service';
import type { PresignPhotoDto } from './dto/presign-photo.dto';

@ApiTags('photos')
@Controller('photos')
export class PhotoController {
  constructor(private photoService: PhotoService) {}

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  async presign(@Body() dto: PresignPhotoDto, @Req() req: Request) {
    return this.photoService.presign(req.user!.id, dto);
  }

  @Post(':photoId/confirm')
  @UseGuards(JwtAuthGuard)
  async confirm(@Param('photoId') photoId: string, @Req() req: Request) {
    return this.photoService.confirm(req.user!.id, photoId);
  }

  @Delete(':photoId')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('photoId') photoId: string, @Req() req: Request) {
    return this.photoService.delete(req.user!.id, photoId);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard)
  async reorder(@Body() body: { photoIds: string[] }, @Req() req: Request) {
    return this.photoService.reorder(req.user!.id, body.photoIds);
  }
}
