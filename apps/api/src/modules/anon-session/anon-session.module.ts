import { Module } from '@nestjs/common';
import { AnonSessionController } from './anon-session.controller';
import { AnonSessionService } from './anon-session.service';

@Module({
  controllers: [AnonSessionController],
  providers: [AnonSessionService],
  exports: [AnonSessionService],
})
export class AnonSessionModule {}
