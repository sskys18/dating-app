import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApnsService } from './apns.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [AuthModule],
  providers: [ApnsService, NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
