import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { S3Service } from './s3.service';
import { ModerationService } from './moderation.service';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';

@Module({
  imports: [AuthModule],
  providers: [S3Service, ModerationService, PhotoService],
  controllers: [PhotoController],
  exports: [PhotoService],
})
export class PhotoModule {}
