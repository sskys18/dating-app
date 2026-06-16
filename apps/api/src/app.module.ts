import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AnonSessionModule } from './modules/anon-session/anon-session.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { LlmModule } from './modules/llm/llm.module';
import { ChatModule } from './modules/chat/chat.module';
import { PreviewModule } from './modules/preview/preview.module';
import { AuthModule } from './modules/auth/auth.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { PhotoModule } from './modules/photo/photo.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { BlockModule } from './modules/block/block.module';
import { ReportModule } from './modules/report/report.module';
import { FeedModule } from './modules/feed/feed.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { RetentionModule } from './modules/retention/retention.module';
import { AccountModule } from './modules/account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    LlmModule,
    HealthModule,
    AnonSessionModule,
    QuizModule,
    ChatModule,
    PreviewModule,
    AuthModule,
    HandoffModule,
    PhotoModule,
    ProfileModule,
    SubscriptionModule,
    BlockModule,
    ReportModule,
    FeedModule,
    RealtimeModule,
    NotificationModule,
    PreferencesModule,
    RetentionModule,
    AccountModule,
  ],
})
export class AppModule {}
