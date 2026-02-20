import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
