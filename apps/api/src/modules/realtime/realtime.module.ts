import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockModule } from '../block/block.module';
import { NotificationModule } from '../notification/notification.module';
import { RealtimeGateway } from './realtime.gateway';
import { DatingChatService } from './dating-chat.service';
import { MessageController } from './message.controller';

@Module({
  imports: [AuthModule, BlockModule, NotificationModule],
  providers: [RealtimeGateway, DatingChatService],
  controllers: [MessageController],
  exports: [DatingChatService],
})
export class RealtimeModule {}
